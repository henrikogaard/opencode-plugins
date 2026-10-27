import type { CreatePullInput, MergePullInput, Snapshot, SnapshotInput } from "../rpc"
import { commandError, findGh, firstUrl, run } from "./exec"
import { createPullArgs, pushArgs } from "./args"
import {
  mapPull,
  normalizeRemote,
  parseNumstat,
  parseStatus,
  repoName,
  type RawPull,
} from "./snapshot"

const SNAPSHOT_TTL = 20_000
const AUTH_TTL = 60_000

const snapshots = new Map<string, { at: number; value: Snapshot }>()
const authChecks = new Map<string, { at: number; value: { auth: boolean; error?: string } }>()

export interface Github {
  snapshot(input: SnapshotInput, signal: AbortSignal): Promise<Snapshot>
  createPull(input: CreatePullInput, signal: AbortSignal): Promise<{ ok: boolean; url?: string; error?: string }>
  mergePull(input: MergePullInput, signal: AbortSignal): Promise<{ ok: boolean; error?: string }>
}

export function createGithub(): Github {
  return {
    snapshot,
    createPull,
    mergePull,
  }
}

function cacheKey(input: SnapshotInput): string {
  return [
    input.directory,
    input.branch ?? "",
    input.includeAll ? "all" : "branch",
    input.includeIssues ? "issues" : "no-issues",
    input.ghPath ?? "",
  ].join("\0")
}

function clearDirectory(directory: string): void {
  for (const key of snapshots.keys()) {
    if (key.startsWith(`${directory}\0`)) snapshots.delete(key)
  }
}

function empty(directory: string, error?: string): Snapshot {
  const value: Snapshot = {
    directory,
    branch: "HEAD",
    ahead: 0,
    behind: 0,
    dirty: 0,
    additions: 0,
    deletions: 0,
    auth: false,
    prs: [],
    issues: [],
    at: Date.now(),
  }

  if (error) value.error = error
  return value
}

export function parseJsonArray(value: string): unknown[] | undefined {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

async function checkAuth(gh: string, signal: AbortSignal): Promise<{ auth: boolean; error?: string }> {
  const hit = authChecks.get(gh)
  if (hit && Date.now() - hit.at < AUTH_TTL) return hit.value

  const result = await run(gh, ["auth", "status", "--hostname", "github.com"], { signal, timeout: 10_000 })

  if (result.aborted) return { auth: false, error: "Cancelled." }
  if (result.timedOut) return { auth: false, error: "GitHub CLI timed out." }

  if (result.code === 0) {
    const value = { auth: true }
    authChecks.set(gh, { at: Date.now(), value })
    return value
  }

  return {
    auth: false,
    error:
      result.reason === "ENOENT" || result.code === 127
        ? "GitHub CLI (gh) was not found. Install it or set its path in Workbench settings."
        : "GitHub CLI is not signed in. Run `gh auth login` in a terminal.",
  }
}

async function baseBranch(directory: string, gh: string, signal: AbortSignal): Promise<string | undefined> {
  const head = await run("git", ["-C", directory, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { signal })
  if (head.code === 0) {
    const value = head.stdout.trim()
    return value.startsWith("origin/") ? value.slice("origin/".length) : value
  }

  const repo = await run(gh, ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"], {
    cwd: directory,
    signal,
    timeout: 15_000,
  })
  if (repo.code === 0 && repo.stdout.trim()) return repo.stdout.trim()

  return undefined
}

async function snapshot(input: SnapshotInput, signal: AbortSignal): Promise<Snapshot> {
  const key = cacheKey(input)
  if (!input.refresh) {
    const hit = snapshots.get(key)
    if (hit && Date.now() - hit.at < SNAPSHOT_TTL) return hit.value
  }

  const directory = input.directory
  const gh = await findGh(input.ghPath)

  const [status, numstat, remote, originHead] = await Promise.all([
    run("git", ["-C", directory, "status", "--porcelain=v2", "--branch"], { signal }),
    run("git", ["-C", directory, "diff", "HEAD", "--numstat"], { signal }),
    run("git", ["-C", directory, "remote", "get-url", "origin"], { signal }),
    run("git", ["-C", directory, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { signal }),
  ])

  if (status.code !== 0) {
    return empty(directory, commandError(status, "git status"))
  }

  const summary = parseStatus(status.stdout)
  const branch = summary.branch === "HEAD" && input.branch ? input.branch : summary.branch
  const url = remote.code === 0 ? normalizeRemote(remote.stdout) : undefined
  const base =
    originHead.code === 0
      ? originHead.stdout.trim().replace(/^origin\//, "")
      : undefined
  const changes = parseNumstat(numstat.stdout)

  const value: Snapshot = {
    directory,
    branch,
    ahead: summary.ahead,
    behind: summary.behind,
    dirty: summary.dirty,
    additions: changes.additions,
    deletions: changes.deletions,
    auth: false,
    prs: [],
    issues: [],
    at: Date.now(),
  }

  const repo = repoName(url)
  if (repo) value.repo = repo
  if (url) value.url = url
  if (base) value.base = base

  if (!url) {
    value.error = "No GitHub remote in this repository."
    return value
  }

  if (!url.includes("github.com")) {
    value.error = "This repository is not hosted on GitHub."
    return value
  }

  const auth = await checkAuth(gh, signal)
  value.auth = auth.auth

  if (!auth.auth) {
    value.error = auth.error
    return value
  }

  const fields =
    "number,title,url,state,isDraft,headRefName,baseRefName,author,reviewDecision,mergeable,statusCheckRollup,updatedAt"
  const pulls = await run(
    gh,
    ["pr", "list", "--state", "open", "--limit", input.includeAll ? "50" : "10", "--json", fields],
    { cwd: directory, signal, timeout: 30_000 },
  )

  if (pulls.code !== 0) {
    value.error = commandError(pulls, "GitHub PR list")
    return value
  }

  const rawPulls = parseJsonArray(pulls.stdout)
  if (!rawPulls) {
    value.error = "Could not read the pull request list."
    return value
  }

  value.prs = rawPulls
    .map((item) => mapPull(item as RawPull))
    .filter((item): item is NonNullable<typeof item> => item !== undefined)

  const current = value.prs.find((pull) => pull.branch === branch && pull.state === "OPEN")
  if (current) value.current = current

  if (input.includeIssues) {
    const issues = await run(
      gh,
      ["issue", "list", "--assignee", "@me", "--state", "open", "--limit", "10", "--json", "number,title,url,updatedAt"],
      { cwd: directory, signal, timeout: 30_000 },
    )

    if (issues.code !== 0) {
      value.issuesError = commandError(issues, "GitHub issue list")
    } else {
      const rawIssues = parseJsonArray(issues.stdout)
      if (!rawIssues) {
        value.issuesError = "Could not read assigned issues."
      } else {
        value.issues = rawIssues.flatMap((item) => {
          if (!item || typeof item !== "object") return []
          const issue = item as { number?: unknown; title?: unknown; url?: unknown; updatedAt?: unknown }
          if (typeof issue.number !== "number" || typeof issue.title !== "string" || typeof issue.url !== "string") {
            return []
          }
          const updatedAt = typeof issue.updatedAt === "string" ? issue.updatedAt : undefined
          return [
            {
              number: issue.number,
              title: issue.title,
              url: issue.url,
              ...(updatedAt ? { updatedAt } : {}),
            },
          ]
        })
      }
    }
  }

  snapshots.set(key, { at: Date.now(), value })
  return value
}

async function createPull(
  input: CreatePullInput,
  signal: AbortSignal,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const title = input.title.trim()
  if (!title) return { ok: false, error: "A pull request title is required." }

  const gh = await findGh(input.ghPath)
  const auth = await checkAuth(gh, signal)
  if (!auth.auth) return { ok: false, error: auth.error }

  const branchResult = await run("git", ["-C", input.directory, "rev-parse", "--abbrev-ref", "HEAD"], { signal })
  if (branchResult.code !== 0) {
    return { ok: false, error: commandError(branchResult, "git rev-parse") }
  }

  const branch = branchResult.stdout.trim()
  if (!branch || branch === "HEAD") {
    return { ok: false, error: "Cannot create a pull request from a detached HEAD." }
  }

  if (branch.startsWith("-")) {
    return { ok: false, error: "The current branch name cannot start with '-'." }
  }

  const base = input.base?.trim() || (await baseBranch(input.directory, gh, signal))
  if (!base) return { ok: false, error: "Could not determine the base branch." }
  if (base.startsWith("-")) return { ok: false, error: "The base branch name cannot start with '-'." }
  if (base === branch) {
    return { ok: false, error: "The head branch and base branch are the same. Switch to a feature branch first." }
  }

  if (input.push === true) {
    const push = await run("git", ["-C", input.directory, ...pushArgs(branch)], {
      signal,
      timeout: 120_000,
    })
    if (push.code !== 0) return { ok: false, error: commandError(push, "git push") }
  }

  const args = createPullArgs({
    branch,
    base,
    title,
    body: input.body ?? "",
    draft: input.draft,
  })

  const result = await run(gh, args, { cwd: input.directory, signal, timeout: 60_000 })
  if (result.code !== 0) return { ok: false, error: commandError(result, "gh pr create") }

  clearDirectory(input.directory)
  const url = firstUrl(result.stdout) ?? firstUrl(result.stderr)
  return { ok: true, ...(url ? { url } : {}) }
}

async function mergePull(
  input: MergePullInput,
  signal: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(input.number) || input.number <= 0) {
    return { ok: false, error: "Invalid pull request number." }
  }

  const gh = await findGh(input.ghPath)
  const auth = await checkAuth(gh, signal)
  if (!auth.auth) return { ok: false, error: auth.error }

  const view = await run(gh, ["pr", "view", String(input.number), "--json", "state,mergeable,headRefName"], {
    cwd: input.directory,
    signal,
    timeout: 20_000,
  })

  if (view.code !== 0) return { ok: false, error: commandError(view, "gh pr view") }

  let state: { state?: string; mergeable?: string; headRefName?: string } = {}
  try {
    state = JSON.parse(view.stdout) as typeof state
  } catch {
    return { ok: false, error: "Could not read the pull request state." }
  }

  if (state.state !== "OPEN") return { ok: false, error: "This pull request is not open." }
  if (state.mergeable === "CONFLICTING") return { ok: false, error: "This pull request has conflicts." }

  const args = ["pr", "merge", String(input.number), `--${input.method}`]
  if (input.deleteBranch === true) args.push("--delete-branch")

  const result = await run(gh, args, { cwd: input.directory, signal, timeout: 120_000 })
  if (result.code !== 0) return { ok: false, error: commandError(result, "gh pr merge") }

  clearDirectory(input.directory)
  return { ok: true }
}
