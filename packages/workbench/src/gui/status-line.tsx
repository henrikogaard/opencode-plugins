import { Show, createMemo } from "solid-js"
import { createKeyed, usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { basename, relativeTime } from "./format"
import { checksIcon, checksTone, toneClass } from "./icons"
import { contextInfo } from "./metrics"
import type { WorkbenchState } from "./state"

export function StatusLine(props: { state: WorkbenchState }) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const session = () => ctx.sessions.current()
  const directory = () => session()?.directory

  createKeyed(directory, (dir) => props.state.watch(dir))

  const snapshot = createMemo(() => props.state.snapshot(directory()))
  const branch = () => {
    const current = session()
    if (!current) return undefined

    return (
      snapshot()?.branch ||
      (current.location ? current.server.data.location.vcs.info(current.location)?.branch.current : undefined)
    )
  }
  const project = () => {
    const current = session()
    return current?.listedProject?.name ?? (current ? basename(current.directory) : undefined)
  }
  const pull = () => snapshot()?.current
  const otherPulls = () => (pull() ? 0 : (snapshot()?.prs.length ?? 0))
  const dirty = () => snapshot()?.dirty ?? 0
  const tasks = () => session()?.background.length ?? 0
  const context = createMemo(() => {
    const current = session()
    return current ? contextInfo(current, ctx.screen.current()?.composer.model()) : undefined
  })
  const error = () => props.state.error(directory()) ?? snapshot()?.error
  const loading = () => props.state.loading(directory())
  const updated = () => relativeTime(snapshot()?.at)

  return (
    <Show when={session()}>
      {(current) => (
        <div class="wb-status" data-workbench="status-line">
          <button
            type="button"
            class="wb-status-main"
            title={ctx.t("status.open")}
            onClick={() => props.state.openPanel(current())}
          >
            <span class="wb-status-item">
              <ui.Icon name="folder" size="small" />
              <span class="truncate">{project()}</span>
            </span>
            <span class="wb-status-sep" />
            <span class="wb-status-item">
              <ui.Icon name="branch" size="small" />
              <span class="truncate">{branch() ?? "HEAD"}</span>
            </span>
            <Show when={pull()}>
              {(value) => (
                <span class={`wb-status-item ${toneClass(checksTone(value().checks))}`}>
                  <ui.Icon name={checksIcon(value().checks)} size="small" />
                  <span>PR #{value().number}</span>
                </span>
              )}
            </Show>
            <Show when={otherPulls() > 0}>
              <span class="wb-status-item">
                <ui.Icon name="github" size="small" />
                <span>{otherPulls()} PRs</span>
              </span>
            </Show>
            <Show when={dirty() > 0}>
              <span class="wb-status-sep" />
              <span class="wb-status-item">
                <span class="wb-warn">●</span>
                {dirty()} changed
              </span>
            </Show>
            <Show when={tasks() > 0}>
              <span class="wb-status-sep" />
              <span class="wb-status-item">
                <ui.Icon name="task" size="small" />
                {tasks()}
              </span>
            </Show>
            <Show when={context()?.limit}>
              <span class="wb-status-sep" />
              <span class="wb-status-item">
                <ui.Icon name="brain" size="small" />
                {context()?.pct ?? 0}%
              </span>
            </Show>
            <Show when={error()}>
              <span class="wb-status-item wb-status-error" title={error()}>
                <ui.Icon name="warning" size="small" />
              </span>
            </Show>
          </button>
          <div class="wb-status-right">
            <Show when={loading()}>
              <ui.Loader size="small" />
            </Show>
            <Show when={updated()}>
              {(value) => <span class="wb-mono wb-faint">{value()}</span>}
            </Show>
            <ui.Tooltip value={ctx.t("panel.refresh")}>
              <ui.IconButton
                icon="refresh"
                label={ctx.t("panel.refresh")}
                size="small"
                variant="ghost-muted"
                onClick={() => {
                  const dir = directory()
                  if (dir) void props.state.refresh(dir, true)
                }}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("panel.open")}>
              <ui.IconButton
                icon="layout-right"
                label={ctx.t("panel.open")}
                size="small"
                variant="ghost-muted"
                onClick={() => props.state.openPanel(current())}
              />
            </ui.Tooltip>
          </div>
        </div>
      )}
    </Show>
  )
}
