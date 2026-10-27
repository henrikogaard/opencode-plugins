import type { SubagentSession } from "../shared/subagents"

interface SessionInfo {
  id: string
  parentID?: string
  title?: string
  agent?: unknown
  model?: { providerID: string; id: string }
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  outcome?: "succeeded" | "failed" | "interrupted"
  time: { created: number; updated: number; idle?: number }
  location: { directory: string }
}

export interface SubagentData {
  session: {
    family(sessionID: string): readonly string[]
    get(sessionID: string): SessionInfo | undefined
    status(sessionID: string): "idle" | "running"
    permission: {
      list(sessionID: string): readonly unknown[] | undefined
    }
    form: {
      list(sessionID: string, location: { directory: string }): readonly unknown[] | undefined
    }
  }
}

export function readSubagentSessions(data: SubagentData, rootID: string, currentID: string): SubagentSession[] {
  const result: SubagentSession[] = []

  for (const id of data.session.family(rootID)) {
    if (id === rootID) continue

    const info = data.session.get(id)
    if (!info) continue

    const permissions = data.session.permission.list(id) ?? []
    const forms = data.session.form.list(id, info.location) ?? []
    const waiting = permissions.length > 0 ? "approval" : forms.length > 0 ? "input" : undefined

    result.push({
      id: info.id,
      parentID: info.parentID,
      title: info.title,
      agent: info.agent ? String(info.agent) : undefined,
      model: info.model ? [info.model.providerID, info.model.id].filter(Boolean).join("/") : undefined,
      cost: info.cost,
      tokens:
        info.tokens.input +
        info.tokens.output +
        info.tokens.reasoning +
        info.tokens.cache.read +
        info.tokens.cache.write,
      status: data.session.status(id),
      outcome: info.outcome,
      waiting,
      created: info.time.created,
      updated: info.time.updated,
      idle: info.time.idle,
      current: id === currentID,
    })
  }

  return result
}
