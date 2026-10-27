import { describe, expect, test } from "bun:test"
import { readSubagentSessions, type SubagentData } from "../src/gui/subagents-model"

function data(overrides?: {
  permissions?: readonly unknown[] | undefined
  forms?: readonly unknown[] | undefined
  includeChild?: boolean
}): SubagentData {
  const includeChild = overrides?.includeChild ?? true

  return {
    session: {
      family: () => (includeChild ? ["root", "child"] : ["root"]),
      get: (id) =>
        id === "child"
          ? {
              id: "child",
              parentID: "root",
              title: "Investigate",
              agent: "explore",
              cost: 0.01,
              tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 3, write: 4 } },
              time: { created: 10, updated: 20 },
              location: { directory: "/repo" },
            }
          : undefined,
      status: () => "running",
      permission: { list: () => overrides?.permissions },
      form: { list: () => overrides?.forms },
    },
  }
}

describe("readSubagentSessions", () => {
  test("tolerates unsynced permission and form stores", () => {
    const rows = readSubagentSessions(data(), "root", "child")

    expect(rows).toHaveLength(1)
    expect(rows[0]?.waiting).toBeUndefined()
    expect(rows[0]?.current).toBe(true)
    expect(rows[0]?.tokens).toBe(10)
  })

  test("skips the root and marks waiting states", () => {
    expect(readSubagentSessions(data({ includeChild: false }), "root", "root")).toHaveLength(0)
    expect(readSubagentSessions(data({ permissions: [{}] }), "root", "root")[0]?.waiting).toBe("approval")
    expect(readSubagentSessions(data({ forms: [{}] }), "root", "root")[0]?.waiting).toBe("input")
  })
})
