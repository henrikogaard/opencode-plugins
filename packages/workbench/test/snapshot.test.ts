import { describe, expect, test } from "bun:test"
import {
  aggregateChecks,
  mapPull,
  normalizeMergeable,
  normalizeRemote,
  normalizeReview,
  parseNumstat,
  parseStatus,
  repoName,
} from "../src/server/snapshot"

describe("parseStatus", () => {
  test("reads branch, ahead/behind and dirty entries", () => {
    const value = parseStatus(
      [
        "# branch.oid abc123",
        "# branch.head feature/workbench",
        "# branch.upstream origin/feature/workbench",
        "# branch.ab +2 -1",
        "1 .M N... 100644 100644 100644 abc abc src/a.ts",
        "? src/new.ts",
        "",
      ].join("\n"),
    )

    expect(value).toEqual({ branch: "feature/workbench", ahead: 2, behind: 1, dirty: 2 })
  })

  test("falls back to HEAD when no branch is reported", () => {
    expect(parseStatus("").branch).toBe("HEAD")
  })
})

describe("parseNumstat", () => {
  test("sums text changes and skips binary markers", () => {
    expect(parseNumstat("10\t2\tsrc/a.ts\n-\t-\timage.png\n3\t0\tsrc/b.ts\n")).toEqual({
      additions: 13,
      deletions: 2,
    })
  })
})

describe("normalizeRemote", () => {
  test("converts scp and ssh remotes to https", () => {
    expect(normalizeRemote("git@github.com:acme/app.git")).toBe("https://github.com/acme/app")
    expect(normalizeRemote("ssh://git@github.com/acme/app.git")).toBe("https://github.com/acme/app")
    expect(normalizeRemote("https://github.com/acme/app.git")).toBe("https://github.com/acme/app")
    expect(repoName("https://github.com/acme/app")).toBe("acme/app")
  })
})

describe("aggregateChecks", () => {
  test("reports failures before pending and success", () => {
    expect(aggregateChecks([])).toBe("none")
    expect(aggregateChecks([{ status: "COMPLETED", conclusion: "SUCCESS" }])).toBe("success")
    expect(
      aggregateChecks([
        { status: "COMPLETED", conclusion: "SUCCESS" },
        { status: "IN_PROGRESS", conclusion: null },
      ]),
    ).toBe("pending")
    expect(
      aggregateChecks([
        { status: "COMPLETED", conclusion: "SUCCESS" },
        { status: "COMPLETED", conclusion: "FAILURE" },
      ]),
    ).toBe("failure")
  })
})

describe("states", () => {
  test("normalizes review and mergeable values", () => {
    expect(normalizeReview("APPROVED")).toBe("approved")
    expect(normalizeReview("CHANGES_REQUESTED")).toBe("changes")
    expect(normalizeReview("REVIEW_REQUIRED")).toBe("required")
    expect(normalizeReview(undefined)).toBe("none")
    expect(normalizeMergeable("MERGEABLE")).toBe("mergeable")
    expect(normalizeMergeable("CONFLICTING")).toBe("conflicting")
    expect(normalizeMergeable("UNKNOWN")).toBe("unknown")
  })
})

describe("mapPull", () => {
  test("maps the gh payload", () => {
    const pull = mapPull({
      number: 42,
      title: "Add workbench",
      url: "https://github.com/acme/app/pull/42",
      state: "OPEN",
      isDraft: false,
      headRefName: "feature/workbench",
      baseRefName: "main",
      author: { login: "henrik" },
      reviewDecision: "APPROVED",
      mergeable: "MERGEABLE",
      statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
      updatedAt: "2026-10-27T12:00:00Z",
    })

    expect(pull).toEqual({
      number: 42,
      title: "Add workbench",
      url: "https://github.com/acme/app/pull/42",
      state: "OPEN",
      draft: false,
      branch: "feature/workbench",
      base: "main",
      author: "henrik",
      review: "approved",
      mergeable: "mergeable",
      checks: "success",
      updatedAt: "2026-10-27T12:00:00Z",
    })
  })

  test("drops entries without the required identity", () => {
    expect(mapPull({ title: "Missing number" })).toBeUndefined()
  })
})
