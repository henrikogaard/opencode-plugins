export function basename(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path
}

export function relativeTime(value: string | number | undefined, now = Date.now()): string | undefined {
  if (value === undefined) return undefined

  const time = typeof value === "number" ? value : Date.parse(value)
  if (!Number.isFinite(time)) return undefined

  const seconds = Math.max(0, Math.round((now - time) / 1_000))
  if (seconds < 45) return "now"
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h`

  return `${Math.round(seconds / 86_400)}d`
}

export function humanizeBranch(branch: string): string {
  return branch
    .replace(/^(feat|fix|chore|docs|refactor|test|perf)\//, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}

export function shortPath(path: string, length = 48): string {
  if (path.length <= length) return path
  return `…${path.slice(-(length - 1))}`
}
