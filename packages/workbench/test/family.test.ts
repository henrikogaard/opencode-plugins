import { describe, expect, test } from "bun:test"
import { syncFamily, type FamilyData } from "../src/shared/family"

function fakeFamily(children: Record<string, string[]>): { data: FamilyData; synced: string[] } {
  const known = ["root"]
  const synced: string[] = []

  const data: FamilyData = {
    session: {
      family: () => [...known],
      sync: async (id) => {
        synced.push(id)
        for (const child of children[id] ?? []) {
          if (!known.includes(child)) known.push(child)
        }
      },
    },
  }

  return { data, synced }
}

describe("syncFamily", () => {
  test("discovers every descendant, not just direct children", async () => {
    const { data, synced } = fakeFamily({ root: ["child"], child: ["grand"], grand: [] })

    await syncFamily(data, "root")

    expect(synced).toEqual(["root", "child", "grand"])
  })

  test("continues after a failed member", async () => {
    const known = ["root"]
    const synced: string[] = []

    const data: FamilyData = {
      session: {
        family: () => [...known],
        sync: async (id) => {
          synced.push(id)
          if (id === "child") throw new Error("offline")
          for (const child of { root: ["child"], child: ["grand"], grand: [] }[id] ?? []) {
            if (!known.includes(child)) known.push(child)
          }
        },
      },
    }

    await syncFamily(data, "root")

    expect(synced).toEqual(["root", "child"])
  })

  test("honours the member cap", async () => {
    const { data, synced } = fakeFamily({ root: ["a"], a: ["b"], b: ["c"], c: [] })

    await syncFamily(data, "root", { maxMembers: 2 })

    expect(synced).toEqual(["root", "a"])
  })
})
