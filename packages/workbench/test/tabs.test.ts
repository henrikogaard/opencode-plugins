import { describe, expect, test } from "bun:test"
import { orderTabs, type TabRow } from "../src/shared/tabs"

const rows: TabRow[] = [
  { key: "a", index: 0, group: "alpha", updated: 10, draft: false },
  { key: "b", index: 1, group: "zeta", updated: 30, draft: false },
  { key: "c", index: 2, group: "alpha", updated: 20, draft: false },
  { key: "d", index: 3, group: "~ Drafts", updated: 0, draft: true },
]

describe("orderTabs", () => {
  test("groups projects alphabetically, drafts last, keeping strip order inside a group", () => {
    expect(orderTabs(rows, "project").map((row) => row.key)).toEqual(["a", "c", "b", "d"])
  })

  test("orders by update time when asked", () => {
    expect(orderTabs(rows, "recent").map((row) => row.key)).toEqual(["b", "c", "a", "d"])
  })

  test("does not mutate the input", () => {
    const copy = rows.map((row) => row.key)
    orderTabs(rows, "project")
    expect(rows.map((row) => row.key)).toEqual(copy)
  })
})
