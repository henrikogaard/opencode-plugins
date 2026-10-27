import type { CheckState, MergeableState, PullRequest, ReviewState } from "../rpc"

export interface StatusSummary {
  branch: string
  ahead: number
  behind: number
  dirty: number
}

export interface NumstatSummary {
  additions: number
  deletions: number
}

export interface RawPull {
  number?: number
  title?: string
  url?: string
  state?: string
  isDraft?: boolean
  headRefName?: string
  baseRefName?: string
  reviewDecision?: string
  mergeable?: string
  statusCheckRollup?: unknown
  updatedAt?: string
  author?: { login?: string } | string
}

export function parseStatus(stdout: string): StatusSummary {
  let branch = ""
  let ahead = 0
  let behind = 0
  let dirty = 0

  for (const line of stdout.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim()
      continue
    }

    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+)\s+-(\d+)/)
      if (match) {
        ahead = Number(match[1])
        behind = Number(match[2])
      }
      continue
    }

    if (/^[12u?] /.test(line)) dirty++
  }

  return { branch: branch || "HEAD", ahead, behind, dirty }
}

export function parseNumstat(stdout: string): NumstatSummary {
  let additions = 0
  let deletions = 0

  for (const line of stdout.split("\n")) {
    const [added, removed] = line.split("\t")
    if (!added || !removed) continue
    if (added === "-" || removed === "-") continue
    additions += Number(added) || 0
    deletions += Number(removed) || 0
  }

  return { additions, deletions }
}

export function normalizeRemote(remote: string): string | undefined {
  const value = remote.trim()
  if (!value) return undefined

  const scp = value.match(/^git@([^:]+):(.+)$/)
  if (scp) return `https://${scp[1]}/${scp[2].replace(/\.git$/, "")}`

  const ssh = value.match(/^ssh:\/\/git@([^/]+)\/(.+)$/)
  if (ssh) return `https://${ssh[1]}/${ssh[2].replace(/\.git$/, "")}`

  if (/^https?:\/\//.test(value)) return value.replace(/\.git$/, "")

  return value
}

export function repoName(url: string | undefined): string | undefined {
  if (!url) return undefined

  const parts = url.replace(/\/$/, "").split("/")
  if (parts.length < 2) return undefined

  return parts.slice(-2).join("/")
}

const FAILED = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "ERROR"])
const PENDING = new Set(["IN_PROGRESS", "QUEUED", "PENDING", "WAITING", "REQUESTED"])

export function aggregateChecks(rollup: unknown): CheckState {
  if (!Array.isArray(rollup) || rollup.length === 0) return "none"

  let pending = false

  for (const item of rollup) {
    if (!item || typeof item !== "object") continue

    const value = item as Record<string, unknown>
    const conclusion = typeof value.conclusion === "string" ? value.conclusion.toUpperCase() : undefined
    const status = typeof value.status === "string" ? value.status.toUpperCase() : undefined
    const state = typeof value.state === "string" ? value.state.toUpperCase() : undefined

    if ((conclusion && FAILED.has(conclusion)) || (state && FAILED.has(state))) return "failure"
    if ((status && status !== "COMPLETED") || (state && PENDING.has(state))) pending = true
  }

  return pending ? "pending" : "success"
}

export function normalizeReview(value: string | undefined): ReviewState {
  if (value === "APPROVED") return "approved"
  if (value === "CHANGES_REQUESTED") return "changes"
  if (value === "REVIEW_REQUIRED") return "required"
  return "none"
}

export function normalizeMergeable(value: string | undefined): MergeableState {
  if (value === "MERGEABLE") return "mergeable"
  if (value === "CONFLICTING") return "conflicting"
  return "unknown"
}

export function mapPull(raw: RawPull): PullRequest | undefined {
  if (typeof raw.number !== "number" || typeof raw.title !== "string" || typeof raw.url !== "string") return undefined

  const author = typeof raw.author === "string" ? raw.author : raw.author?.login
  const updatedAt = raw.updatedAt

  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    state: raw.state ?? "OPEN",
    draft: raw.isDraft === true,
    branch: raw.headRefName ?? "",
    base: raw.baseRefName ?? "",
    review: normalizeReview(raw.reviewDecision),
    mergeable: normalizeMergeable(raw.mergeable),
    checks: aggregateChecks(raw.statusCheckRollup),
    ...(author ? { author } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  }
}

export function baseName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path
}
