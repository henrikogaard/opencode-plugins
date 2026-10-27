import { describe, expect, test } from "bun:test"
import { parseJsonArray } from "../src/server/github"

describe("parseJsonArray", () => {
  test("returns undefined instead of an empty list on malformed output", () => {
    expect(parseJsonArray("[]")).toEqual([])
    expect(parseJsonArray('[{"number":1}]')).toEqual([{ number: 1 }])
    expect(parseJsonArray("not json")).toBeUndefined()
    expect(parseJsonArray('{"number":1}')).toBeUndefined()
  })
})
