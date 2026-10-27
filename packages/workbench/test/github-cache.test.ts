import { describe, expect, test, beforeEach } from "bun:test"
import { clearCaches, createGithub } from "../src/server/github"
import type { RunOptions, RunResult } from "../src/server/exec"

const DIRECTORY = "/repo"
const BRANCH_STATUS = [
  "# branch.oid abc123",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +0 -0",
  "",
].join("\n")

function result(overrides: Partial<RunResult>): RunResult {
  return { code: 0, stdout: "", stderr: "", aborted: false, timedOut: false, ...overrides }
}

interface Call {
  command: string
  args: readonly string[]
}

function fakeRun(handlers: Record<string, RunResult | ((call: Call) => RunResult)>) {
  const calls: Call[] = []

  const run = async (command: string, args: readonly string[], options?: RunOptions): Promise<RunResult> => {
    const call = { command, args }
    calls.push(call)

    if (options?.signal?.aborted) return result({ code: 1, aborted: true })

    const normalized = command === "gh" || command.includes("/gh") ? "gh" : command
    const key = `${normalized} ${args.join(" ")}`
    const handler = handlers[key] ?? handlers[Object.keys(handlers).find((candidate) => candidate.startsWith("gh pr list") && key.startsWith("gh pr list")) ?? ""]

    if (handler) return typeof handler === "function" ? handler(call) : handler

    if (key.startsWith("gh pr create")) return handlers["gh pr create"] as RunResult

    throw new Error(`Unexpected command: ${key}`)
  }

  return { run, calls }
}

function responses(): Record<string, RunResult> {
  return {
    [`git -C ${DIRECTORY} status --porcelain=v2 --branch`]: result({ stdout: BRANCH_STATUS }),
    [`git -C ${DIRECTORY} diff HEAD --numstat`]: result({ stdout: "1\t0\ta.ts\n" }),
    [`git -C ${DIRECTORY} remote get-url origin`]: result({ stdout: "git@github.com:acme/app.git\n" }),
    [`git -C ${DIRECTORY} symbolic-ref --short refs/remotes/origin/HEAD`]: result({ stdout: "origin/main\n" }),
    [`gh auth status --hostname github.com`]: result({ code: 0 }),
    [`gh pr list --state open --limit 50 --json number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,statusCheckRollup,updatedAt`]:
      result({
        stdout: JSON.stringify([
          {
            number: 1,
            title: "One",
            url: "https://github.com/acme/app/pull/1",
            state: "OPEN",
            isDraft: false,
            headRefName: "feature",
            baseRefName: "main",
          },
        ]),
      }),
    [`git -C ${DIRECTORY} rev-parse --abbrev-ref HEAD`]: result({ stdout: "feature\n" }),
    [`git -C ${DIRECTORY} push -u origin -- refs/heads/feature`]: result({ code: 0 }),
    "gh pr create": result({ code: 1, stderr: "create failed" }),
  }
}

function githubWith(
  handlers: Record<string, RunResult | ((call: Call) => RunResult)>,
  ghPath: string,
): { github: ReturnType<typeof createGithub>; calls: Call[] } {
  const { run, calls } = fakeRun({ ...responses(), ...handlers })

  return {
    github: createGithub({ run, findGh: async () => ghPath }),
    calls,
  }
}

const signal = new AbortController().signal

beforeEach(() => {
  clearCaches()
})

describe("snapshot caching", () => {
  test("uses the cache for a successful snapshot", async () => {
    const { github, calls } = githubWith({}, "/fake/gh-a")

    await github.snapshot({ directory: DIRECTORY, includeAll: true, refresh: true }, signal)
    const first = calls.length
    await github.snapshot({ directory: DIRECTORY, includeAll: true, refresh: false }, signal)

    expect(calls.length).toBe(first)
  })

  test("does not cache an issue failure", async () => {
    const key = `gh issue list --assignee @me --state open --limit 10 --json number,title,url,updatedAt`
    const { github, calls } = githubWith({ [key]: result({ code: 1, stderr: "offline" }) }, "/fake/gh-b")

    const first = await github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: true }, signal)
    expect(first.issuesError).toBe("offline")

    const count = calls.length
    const second = await github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: false }, signal)
    expect(calls.length).toBeGreaterThan(count)
    expect(second.issuesError).toBe("offline")
  })

  test("does not cache a timeout or malformed issue output", async () => {
    const key = `gh issue list --assignee @me --state open --limit 10 --json number,title,url,updatedAt`

    const timeout = githubWith({ [key]: result({ code: 1, timedOut: true }) }, "/fake/gh-c")
    await timeout.github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: true }, signal)
    expect(timeout.calls.length).toBeGreaterThan(0)
    const beforeTimeout = timeout.calls.length
    await timeout.github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: false }, signal)
    expect(timeout.calls.length).toBeGreaterThan(beforeTimeout)

    const malformed = githubWith({ [key]: result({ stdout: "not json" }) }, "/fake/gh-d")
    await malformed.github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: true }, signal)
    const beforeMalformed = malformed.calls.length
    await malformed.github.snapshot({ directory: DIRECTORY, includeIssues: true, refresh: false }, signal)
    expect(malformed.calls.length).toBeGreaterThan(beforeMalformed)
  })

  test("does not cache an aborted snapshot", async () => {
    const { github, calls } = githubWith({}, "/fake/gh-e")
    const controller = new AbortController()
    controller.abort()

    const first = await github.snapshot({ directory: DIRECTORY, refresh: true }, controller.signal)
    expect(first.error).toBe("Cancelled.")

    const count = calls.length
    await github.snapshot({ directory: DIRECTORY, refresh: false }, signal)
    expect(calls.length).toBeGreaterThan(count)
  })

  test("does not cache a failed auth check", async () => {
    const { github, calls } = githubWith(
      { [`gh auth status --hostname github.com`]: result({ code: 1, stderr: "not signed in" }) },
      "/fake/gh-f",
    )

    await github.snapshot({ directory: DIRECTORY, refresh: true }, signal)
    await github.snapshot({ directory: DIRECTORY, refresh: false }, signal)

    const authCalls = calls.filter(
      (call) => (call.command === "gh" || call.command.includes("/gh")) && call.args[0] === "auth",
    )
    expect(authCalls.length).toBe(2)
  })
})

describe("push followed by a failed PR creation", () => {
  test("reports the push and invalidates the snapshot cache", async () => {
    const { github, calls } = githubWith({}, "/fake/gh-g")

    await github.snapshot({ directory: DIRECTORY, refresh: true }, signal)
    const before = calls.length

    const created = await github.createPull(
      { directory: DIRECTORY, title: "Test", body: "", base: "main", push: true },
      signal,
    )

    expect(created.ok).toBe(false)
    expect(created.pushed).toBe(true)

    await github.snapshot({ directory: DIRECTORY, refresh: false }, signal)
    expect(calls.length).toBeGreaterThan(before)
  })
})
