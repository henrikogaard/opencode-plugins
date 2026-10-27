import type { ComposerModel, MountedSession } from "@opencode/plugin/gui"
import { percent } from "./format"

interface TokenUsage {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

interface MaybeTokens {
  type?: string
  tokens?: TokenUsage
}

export interface ContextInfo {
  used: number
  limit?: number
  pct: number
  cost: number
}

export function contextInfo(session: MountedSession, model: ComposerModel | undefined): ContextInfo {
  const data = session.server.data
  const messages = data.session.message.list(session.id) as MaybeTokens[]

  let tokens: TokenUsage | undefined
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.type === "assistant" && message.tokens) {
      tokens = message.tokens
      break
    }
  }

  const used = tokens ? tokens.input + tokens.cache.read + tokens.cache.write : 0
  const models = session.location ? data.location.model.list(session.location) : undefined
  const info = model
    ? models?.find(
        (item) =>
          item.providerID === model.providerID && (item.id === model.modelID || item.modelID === model.modelID),
      )
    : undefined
  const limit = info?.limit.context
  const cost = data.session.cost(session.id)

  return { used, limit, pct: limit ? percent(used, limit) : 0, cost }
}
