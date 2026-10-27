import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { usePlugin, type IconName, type MountedSession } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import {
  buildSubagentRows,
  formatDuration,
  formatTokens,
  type SubagentRow,
  type SubagentSession,
  type SubagentState,
} from "../shared/subagents"

export function SubagentsSection(props: { session: MountedSession }) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const data = () => props.session.server.data
  const rootID = () => data().session.root(props.session.id)
  const [now, setNow] = createSignal(Date.now())

  const sessions = createMemo<SubagentSession[]>(() => {
    const result: SubagentSession[] = []

    for (const id of data().session.family(rootID())) {
      const info = data().session.get(id)
      if (!info) continue

      const permissions = data().session.permission.list(id)
      const forms = data().session.form.list(id, info.location)
      const waiting = permissions.length > 0 ? "approval" : forms && forms.length > 0 ? "input" : undefined

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
        status: data().session.status(id),
        outcome: info.outcome,
        waiting,
        created: info.time.created,
        updated: info.time.updated,
        idle: info.time.idle,
        current: id === props.session.id,
      })
    }

    return result
  })

  const rows = createMemo(() => buildSubagentRows(rootID(), sessions()))
  const active = createMemo(
    () => rows().filter((row) => row.state === "running" || row.state === "approval" || row.state === "input").length,
  )

  createEffect(() => {
    const id = rootID()
    if (!id) return
    void data().session.sync(id, { children: true }).catch(() => {})
  })

  createEffect(() => {
    const root = rootID()

    for (const id of data().session.family(root)) {
      if (id === root || data().session.status(id) !== "running") continue

      const info = data().session.get(id)
      if (!info) continue

      void data().session.permission.sync(id).catch(() => {})
      void data().session.form.sync(id, info.location).catch(() => {})
    }
  })

  createEffect(() => {
    if (active() === 0) return

    const timer = setInterval(() => setNow(Date.now()), 1_000)
    onCleanup(() => clearInterval(timer))
  })

  const elapsed = (row: SubagentRow) => {
    const end = row.status === "running" ? now() : (row.idle ?? row.updated)
    return formatDuration(Math.max(0, end - row.created))
  }

  const open = (id: string) => {
    ctx.tabs.open({ server: props.session.server.id, id }, { focus: true })
  }

  const copy = (id: string) => {
    void ctx.system.copy(id).then(() => ctx.toast.show({ title: ctx.t("panel.subagents.copied") }))
  }

  const icon = (state: SubagentState): IconName => {
    if (state === "approval") return "warning"
    if (state === "input") return "speech-bubble"
    if (state === "failed") return "circle-x"
    if (state === "done") return "circle-check"
    return "dash"
  }

  const tone = (state: SubagentState): string => {
    if (state === "approval" || state === "input") return "wb-warn"
    if (state === "failed") return "wb-bad"
    if (state === "done") return "wb-ok"
    return "wb-faint"
  }

  const label = (state: SubagentState): string => {
    if (state === "running") return ctx.t("panel.subagents.running")
    if (state === "approval") return ctx.t("panel.subagents.approval")
    if (state === "input") return ctx.t("panel.subagents.input")
    if (state === "failed") return ctx.t("panel.subagents.failed")
    if (state === "done") return ctx.t("panel.subagents.done")
    return ctx.t("panel.subagents.idle")
  }

  return (
    <section class="wb-panel-section" data-workbench="subagents">
      <div class="wb-section-head">
        <span>{ctx.t("panel.subagents")}</span>
        <Show when={rows().length > 0}>
          <span class="wb-section-count">
            {active() > 0 ? `${active()} / ${rows().length}` : rows().length}
          </span>
        </Show>
      </div>

      <Show when={rows().length > 0} fallback={<div class="wb-empty">{ctx.t("panel.subagents.empty")}</div>}>
        <For each={rows()}>
          {(row) => (
            <div
              class="wb-row wb-subagent"
              style={{ "padding-inline-start": `${6 + Math.max(0, row.depth - 1) * 12}px` }}
            >
              <span class={`wb-subagent-state ${tone(row.state)}`} title={label(row.state)}>
                <Show when={row.state === "running"} fallback={<ui.Icon name={icon(row.state)} size="small" />}>
                  <ui.Loader size="small" />
                </Show>
              </span>

              <button
                type="button"
                class="wb-row-main wb-row-button"
                title={ctx.t("panel.subagents.open")}
                onClick={() => open(row.id)}
              >
                <span class="wb-row-title">
                  <span class="truncate">{row.title || row.agent || "Subagent"}</span>
                  <Show when={row.current}>
                    <span class="wb-badge">{ctx.t("panel.subagents.current")}</span>
                  </Show>
                  <Show when={row.state === "approval" || row.state === "input" || row.state === "failed"}>
                    <span class={`wb-badge ${tone(row.state)}`}>{label(row.state)}</span>
                  </Show>
                </span>
                <span class="wb-row-detail">
                  <span>{row.agent ?? "subagent"}</span>
                  <Show when={row.model}>
                    <span>· {row.model}</span>
                  </Show>
                  <span>· {elapsed(row)}</span>
                  <Show when={row.tokens > 0}>
                    <span>· {formatTokens(row.tokens)} tok</span>
                  </Show>
                  <Show when={row.cost > 0}>
                    <span>· ${row.cost.toFixed(2)}</span>
                  </Show>
                </span>
              </button>

              <div class="wb-row-end">
                <ui.Tooltip value={ctx.t("panel.subagents.copy")}>
                  <ui.IconButton
                    icon="copy"
                    label={ctx.t("panel.subagents.copy")}
                    size="small"
                    variant="ghost-muted"
                    onClick={() => copy(row.id)}
                  />
                </ui.Tooltip>
              </div>
            </div>
          )}
        </For>
      </Show>
    </section>
  )
}
