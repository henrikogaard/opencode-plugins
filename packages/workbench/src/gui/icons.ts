import type { IconName } from "@opencode/plugin/gui"
import type { CheckState, MergeableState, ReviewState } from "../rpc"

export type Tone = "success" | "warning" | "danger" | undefined

export function checksIcon(state: CheckState): IconName {
  if (state === "success") return "circle-check"
  if (state === "failure") return "circle-x"
  if (state === "pending") return "circle-exclamation"
  return "dash"
}

export function checksTone(state: CheckState): Tone {
  if (state === "success") return "success"
  if (state === "failure") return "danger"
  if (state === "pending") return "warning"
  return undefined
}

export function reviewIcon(state: ReviewState): IconName {
  if (state === "approved") return "check"
  if (state === "changes") return "warning"
  if (state === "required") return "eye"
  return "dash"
}

export function reviewTone(state: ReviewState): Tone {
  if (state === "approved") return "success"
  if (state === "changes") return "danger"
  if (state === "required") return "warning"
  return undefined
}

export function mergeIcon(state: MergeableState): IconName {
  if (state === "mergeable") return "check"
  if (state === "conflicting") return "warning"
  return "dash"
}

export function mergeTone(state: MergeableState): Tone {
  if (state === "mergeable") return "success"
  if (state === "conflicting") return "danger"
  return undefined
}

export function toneClass(tone: Tone): string {
  if (tone === "success") return "wb-ok"
  if (tone === "danger") return "wb-bad"
  if (tone === "warning") return "wb-warn"
  return "wb-faint"
}
