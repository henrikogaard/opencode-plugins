import { createEffect } from "solid-js"
import type { SetupContext } from "@opencode/plugin/gui"
import { orderTabs, type TabRow } from "../shared/tabs"
import type { definition } from "./definition"
import { basename } from "./format"

export function readTabRows(ctx: SetupContext<typeof definition>): TabRow[] {
  return ctx.tabs.list().map((tab, index) => {
    const session = tab.session
    const info = session?.location ? session.server.data.location.info(session.location) : undefined
    const project =
      info && session ? session.server.data.project.list().find((item) => item.id === info.project.id) : undefined
    const sessionInfo = session
      ? session.server.data.session.list().find((item) => item.id === session.id)
      : undefined

    const group = project
      ? project.name || basename(project.canonical)
      : info
        ? basename(info.project.directory)
        : session
          ? basename(session.location?.directory ?? "")
          : "~ Drafts"

    return {
      key: tab.key,
      index,
      group,
      updated: sessionInfo?.time.updated ?? 0,
      draft: !session,
    }
  })
}

export function sortTabsByProject(ctx: SetupContext<typeof definition>): number {
  const rows = readTabRows(ctx)
  if (rows.length < 2) return 0

  const current = rows.map((row) => row.key).join("\n")
  const order = orderTabs(rows, "project")
  const next = order.map((row) => row.key).join("\n")

  if (current === next) return 0

  order.forEach((row, index) => ctx.tabs.move(row.key, index))
  return rows.filter((row) => order.findIndex((item) => item.key === row.key) !== row.index).length
}

export function installAutoGroup(ctx: SetupContext<typeof definition>): void {
  let lastSignature = ""

  createEffect(() => {
    const prefs = ctx.stores.prefs
    if (!prefs.value.enabled || !prefs.value.autoGroup) {
      lastSignature = ""
      return
    }

    const rows = readTabRows(ctx)
    const signature = rows.map((row) => row.key).join("\n")
    if (signature === lastSignature) return

    lastSignature = signature

    const order = orderTabs(rows, "project")
    const next = order.map((row) => row.key).join("\n")
    if (next === signature) return

    order.forEach((row, index) => ctx.tabs.move(row.key, index))
  })
}
