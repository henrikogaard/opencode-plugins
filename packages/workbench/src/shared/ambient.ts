export type AmbientMode = "off" | "dither" | "ascii" | "pixel" | "image"

export const AMBIENT_MODES: readonly AmbientMode[] = ["off", "dither", "ascii", "pixel", "image"]

export const BAYER_4: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

export function bayer(x: number, y: number): number {
  const row = BAYER_4[((y % 4) + 4) % 4]
  const value = row[((x % 4) + 4) % 4] ?? 0
  return value / 16
}

export const GLYPHS = " .:-=+*#%@"

export function glyphIndex(intensity: number, count: number = GLYPHS.length): number {
  const value = Math.min(1, Math.max(0, intensity))
  return Math.min(count - 1, Math.floor(value * count))
}

export function glyph(intensity: number): string {
  return GLYPHS[glyphIndex(intensity)] ?? "."
}

/**
 * A smooth, layered sine field in [0, 1]. `t` advances with time, `x` and `y`
 * are scaled coordinates, so callers can map it onto any resolution.
 */
export function field(x: number, y: number, t: number): number {
  const value = Math.sin(x * 0.7 + t) + Math.sin(y * 0.5 - t * 0.8) + Math.sin((x + y) * 0.3 + t * 0.5)
  return (value + 3) / 6
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
