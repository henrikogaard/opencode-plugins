import { describe, expect, test } from "bun:test"
import { definition } from "../src/gui/definition"

describe("i18n copy", () => {
  test("uses double-brace placeholders", () => {
    for (const [key, value] of Object.entries(definition.i18n?.en ?? {})) {
      expect(value, key).not.toMatch(/(^|[^{])\{[a-z]+\}([^}]|$)/)
    }
  })
})
