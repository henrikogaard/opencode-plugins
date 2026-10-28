import { describe, expect, test } from "bun:test"
import { bayer, clamp, field, glyph, glyphIndex, GLYPHS } from "../src/shared/ambient"

describe("ambient helpers", () => {
  test("bayer covers the 4x4 threshold matrix", () => {
    const seen = new Set<number>()

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) seen.add(bayer(x, y))
    }

    expect(seen.size).toBe(16)
    expect(bayer(0, 0)).toBe(0)
    expect(bayer(3, 2)).toBe(9 / 16)
  })

  test("maps intensity onto the glyph ramp", () => {
    expect(glyph(0)).toBe(" ")
    expect(glyph(1)).toBe("@")
    expect(glyph(0.5)).toBe("+")
    expect(glyphIndex(-1)).toBe(0)
    expect(glyphIndex(2)).toBe(GLYPHS.length - 1)
  })

  test("keeps the field inside [0, 1]", () => {
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const value = field(x, y, 0)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  test("clamps", () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})
