import { describe, expect, test } from "bun:test"
import { buildSubagentRows, formatDuration, formatTokens, subagentState, type SubagentSession } from "../src/shared/subagents"

function session(overrides: Partial<SubagentSession> & { id: string }): SubagentSession {
  return {
    cost: 0,
    tokens: 0,
    status: "idle",
    created: 0,
    updated: 0,
    ...overrides,
  }
}

describe("buildSubagentRows", () => {
  test("walks the tree depth-first and excludes the root", () => {
    const rows = buildSubagentRows("root", [
      session({ id: "root", created: 0 }),
      session({ id: "a", parentID: "root", created: 20 }),
      session({ id: "b", parentID: "a", created: 30 }),
      session({ id: "c", parentID: "root", created: 10 }),
    ])

    expect(rows.map((row) => [row.id, row.depth])).toEqual([
      ["c", 1],
      ["a", 1],
      ["b", 2],
    ])
  })

  test("keeps orphans as top-level rows", () => {
    const rows = buildSubagentRows("root", [
      session({ id: "root" }),
      session({ id: "orphan", parentID: "missing", created: 5 }),
    ])

    expect(rows.map((row) => [row.id, row.depth])).toEqual([["orphan", 1]])
  })

  test("carries the current marker and state", () => {
    const rows = buildSubagentRows("root", [
      session({ id: "root" }),
      session({ id: "a", parentID: "root", status: "running", current: true }),
    ])

    expect(rows[0]?.state).toBe("running")
    expect(rows[0]?.current).toBe(true)
  })
})

describe("subagentState", () => {
  test("prefers waiting, then running, then outcome", () => {
    expect(subagentState(session({ id: "a", status: "running", waiting: "approval" }))).toBe("approval")
    expect(subagentState(session({ id: "a", status: "running" }))).toBe("running")
    expect(subagentState(session({ id: "a", outcome: "failed" }))).toBe("failed")
    expect(subagentState(session({ id: "a", outcome: "succeeded" }))).toBe("done")
    expect(subagentState(session({ id: "a" }))).toBe("idle")
  })
})

describe("formatting", () => {
  test("formats durations and token counts", () => {
    expect(formatDuration(42_000)).toBe("42s")
    expect(formatDuration(180_000)).toBe("3m")
    expect(formatDuration(7_200_000)).toBe("2h")
    expect(formatTokens(999)).toBe("999")
    expect(formatTokens(1_200)).toBe("1.2k")
    expect(formatTokens(12_000)).toBe("12k")
    expect(formatTokens(2_400_000)).toBe("2.4m")
  })
})
