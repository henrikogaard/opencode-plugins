export type SubagentStatus = "running" | "idle"
export type SubagentOutcome = "succeeded" | "failed" | "interrupted"
export type SubagentWait = "approval" | "input"

export interface SubagentSession {
  id: string
  parentID?: string
  title?: string
  agent?: string
  model?: string
  cost: number
  tokens: number
  status: SubagentStatus
  outcome?: SubagentOutcome
  waiting?: SubagentWait
  created: number
  updated: number
  idle?: number
  current?: boolean
}

export type SubagentState = "running" | "approval" | "input" | "failed" | "done" | "idle"

export interface SubagentRow extends SubagentSession {
  depth: number
  state: SubagentState
}

export function subagentState(session: SubagentSession): SubagentState {
  if (session.waiting) return session.waiting
  if (session.status === "running") return "running"
  if (session.outcome === "failed") return "failed"
  if (session.outcome === "succeeded") return "done"
  return "idle"
}

/**
 * Turns the flat session family into a depth-first tree under `rootID`.
 * Members whose parent is missing from the list are kept as top-level rows
 * instead of disappearing.
 */
export function buildSubagentRows(rootID: string, sessions: readonly SubagentSession[]): SubagentRow[] {
  const byParent = new Map<string, SubagentSession[]>()

  for (const session of sessions) {
    if (session.id === rootID) continue

    const parent = session.parentID ?? rootID
    const list = byParent.get(parent) ?? []
    list.push(session)
    byParent.set(parent, list)
  }

  for (const list of byParent.values()) list.sort((a, b) => a.created - b.created)

  const rows: SubagentRow[] = []

  const visit = (parentID: string, depth: number) => {
    for (const session of byParent.get(parentID) ?? []) {
      rows.push({ ...session, depth, state: subagentState(session) })
      visit(session.id, depth + 1)
    }
  }

  visit(rootID, 1)

  const seen = new Set(rows.map((row) => row.id))
  for (const session of sessions) {
    if (session.id === rootID || seen.has(session.id)) continue
    rows.push({ ...session, depth: 1, state: subagentState(session) })
  }

  return rows
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h`
  return `${Math.round(seconds / 86_400)}d`
}

export function formatTokens(value: number): string {
  if (value < 1_000) return String(value)
  if (value < 1_000_000) {
    const thousands = value / 1_000
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`
  }
  return `${(value / 1_000_000).toFixed(1)}m`
}
