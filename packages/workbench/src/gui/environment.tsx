import { For, Show, createEffect, createMemo, onCleanup } from "solid-js"
import type { JSX } from "solid-js"
import {
  createKeyed,
  usePlugin,
  type IconName,
  type MountedSession,
  type SessionScreen,
} from "@opencode/plugin/gui"
import { Changes } from "@opencode/plugin/gui/review"
import type { PullRequest, Snapshot } from "../rpc"
import type { definition } from "./definition"
import { openCreatePull, openMergePull } from "./dialogs"
import { basename, formatNumber, relativeTime, shortPath } from "./format"
import { checksIcon, checksTone, mergeIcon, mergeTone, reviewIcon, reviewTone, toneClass } from "./icons"
import { contextInfo } from "./metrics"
import type { WorkbenchState } from "./state"

interface Change {
  file: string
  additions: number
  deletions: number
  status?: string
}

interface McpServer {
  name: string
  title?: string
  status: {
    status: "connected" | "pending" | "disabled" | "failed" | "needs_auth"
    error?: string
  }
}

export function EnvironmentView(props: {
  state: WorkbenchState
  session: MountedSession
  screen: SessionScreen
}) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const prefs = ctx.stores.prefs
  const directory = () => props.session.directory

  createKeyed(directory, (dir) => props.state.watch(dir))

  const snapshot = () => props.state.snapshot(directory())
  const loading = () => props.state.loading(directory())
  const error = () => props.state.error(directory()) ?? snapshot()?.error
  const updated = () => relativeTime(snapshot()?.at)
  const url = () => snapshot()?.url
  const branch = () => snapshot()?.branch
  const base = () => snapshot()?.base
  const pulls = () => snapshot()?.prs ?? []
  const issues = () => snapshot()?.issues ?? []
  const current = () => snapshot()?.current
  const needsAuth = () => !!error()?.includes("not signed in")
  const needsGh = () => !!error() && /not found|was not found/i.test(error()!)

  const changes = ctx.use(Changes)
  createKeyed(changes, (value) => onCleanup(value.watch(props.screen, "details")))

  const diffs = createMemo<readonly Change[] | undefined>(() => {
    const live = changes()
    if (live.status !== "active") return undefined
    return live.value.details(props.session)
  })

  const changeTotals = createMemo(() => {
    const list = diffs() ?? []
    return {
      files: list.length,
      additions: list.reduce((sum, item) => sum + item.additions, 0),
      deletions: list.reduce((sum, item) => sum + item.deletions, 0),
    }
  })

  const connectors = createMemo<readonly McpServer[]>(() => {
    const location = props.session.location
    if (!location) return []
    return props.session.server.data.location.mcp.server.list(location) ?? []
  })

  const context = createMemo(() => contextInfo(props.session, props.screen.composer.model()))

  const sortedPulls = createMemo(() => {
    const currentNumber = current()?.number
    const rank = (pull: PullRequest) => (pull.number === currentNumber ? 0 : pull.checks === "failure" ? 1 : 2)

    return [...pulls()].sort((a, b) => {
      const order = rank(a) - rank(b)
      if (order !== 0) return order
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
    })
  })

  createEffect(() => {
    const location = props.session.location
    if (!location) return

    const data = props.session.server.data
    void Promise.allSettled([
      data.location.vcs.sync(location),
      data.location.mcp.server.sync(location),
      data.shell.sync(location),
    ])
  })

  const openGithub = () => {
    const value = url()
    if (value) ctx.system.openExternal(value)
  }

  const focusChange = (file: string) => {
    const live = changes()
    if (live.status === "active") live.value.focus(props.session, file)
  }

  const openChanges = () => {
    const live = changes()
    if (live.status === "active") live.value.open(props.session)
  }

  const copyAuth = () => {
    void ctx.system.copy("gh auth login").then(() => {
      ctx.toast.show({ title: ctx.t("panel.copied") })
    })
  }

  const createPull = () => {
    openCreatePull(ctx, props.state, props.session, snapshot())
  }

  const mergePull = (pull: PullRequest) => {
    openMergePull(ctx, props.state, props.session, pull, snapshot())
  }

  return (
    <div class="wb-panel" data-workbench="environment-panel">
      <div class="wb-panel-header">
        <div class="wb-panel-title">{ctx.t("panel.title")}</div>
        <Show when={updated()}>
          {(value) => <span class="wb-faint wb-mono">{ctx.t("panel.updated", { time: value() })}</span>}
        </Show>
        <ui.Tooltip value={ctx.t("panel.refresh")}>
          <ui.IconButton
            icon="refresh"
            label={ctx.t("panel.refresh")}
            size="small"
            variant="ghost-muted"
            busy={loading()}
            onClick={() => void props.state.refresh(directory(), true)}
          />
        </ui.Tooltip>
        <Show when={url()}>
          <ui.Tooltip value={ctx.t("panel.openGithub")}>
            <ui.IconButton
              icon="github"
              label={ctx.t("panel.openGithub")}
              size="small"
              variant="ghost-muted"
              onClick={openGithub}
            />
          </ui.Tooltip>
        </Show>
        <ui.Tooltip value={ctx.t("settings.title")}>
          <ui.IconButton
            icon="settings-gear"
            label={ctx.t("settings.title")}
            size="small"
            variant="ghost-muted"
            onClick={() => props.state.openSettings()}
          />
        </ui.Tooltip>
      </div>

      <div class="wb-panel-scroll">
        <Show when={error()}>
          {(message) => (
            <div class="wb-error">
              <span>{message()}</span>
              <div class="wb-actions">
                <Show when={needsAuth()}>
                  <ui.Button size="small" variant="neutral" onClick={copyAuth}>
                    {ctx.t("panel.copyAuth")}
                  </ui.Button>
                </Show>
                <Show when={needsGh()}>
                  <ui.Button size="small" variant="neutral" onClick={() => props.state.openSettings()}>
                    {ctx.t("settings.title")}
                  </ui.Button>
                </Show>
                <ui.Button size="small" variant="ghost-muted" onClick={() => void props.state.refresh(directory(), true)}>
                  {ctx.t("panel.retry")}
                </ui.Button>
              </div>
            </div>
          )}
        </Show>

        <Show when={!snapshot() && loading()}>
          <ui.Loader size="normal" />
        </Show>

        <Section title={ctx.t("panel.workspace")}>
          <Workspace
            snapshot={snapshot()}
            project={props.session.listedProject?.name ?? basename(props.session.directory)}
            directory={props.session.directory}
            onCopy={() => void ctx.system.copy(props.session.directory)}
            onOpen={() => props.state.openPanel(props.session)}
          />
        </Section>

        <Show when={prefs.value.prs}>
          <Show
            when={snapshot()}
            fallback={
              <Section title={ctx.t("panel.pulls")}>
                <ui.Loader size="small" />
              </Section>
            }
          >
            <Show
              when={current()}
              fallback={
                <Section title={ctx.t("panel.pulls")} count={pulls().length}>
                  <Show
                    when={pulls().length > 0}
                    fallback={<div class="wb-empty">{ctx.t("panel.noPulls")}</div>}
                  >
                    <For each={sortedPulls()}>
                      {(item) => (
                        <PullRow
                          pull={item}
                          onOpen={() => ctx.system.openExternal(item.url)}
                          onCopy={() =>
                            void ctx.system.copy(item.url).then(() => ctx.toast.show({ title: ctx.t("panel.copied") }))
                          }
                          onMerge={() => mergePull(item)}
                        />
                      )}
                    </For>
                  </Show>
                  <div class="wb-actions">
                    <ui.Button
                      size="small"
                      variant="neutral"
                      icon="plus"
                      disabled={!snapshot()?.auth || !branch() || branch() === base()}
                      onClick={createPull}
                    >
                      {ctx.t("panel.createPull")}
                    </ui.Button>
                  </div>
                </Section>
              }
            >
              {(pull) => (
                <Section title={ctx.t("panel.pulls")} count={pulls().length}>
                  <PullRow
                    pull={pull()}
                    onOpen={() => ctx.system.openExternal(pull().url)}
                    onCopy={() =>
                      void ctx.system.copy(pull().url).then(() => ctx.toast.show({ title: ctx.t("panel.copied") }))
                    }
                    onMerge={() => mergePull(pull())}
                  />
                  <Show when={pulls().length > 1}>
                    <For each={sortedPulls().filter((item) => item.number !== pull().number)}>
                      {(item) => (
                        <PullRow
                          pull={item}
                          onOpen={() => ctx.system.openExternal(item.url)}
                          onCopy={() =>
                            void ctx.system.copy(item.url).then(() =>
                              ctx.toast.show({ title: ctx.t("panel.copied") }),
                            )
                          }
                          onMerge={() => mergePull(item)}
                        />
                      )}
                    </For>
                  </Show>
                </Section>
              )}
            </Show>
          </Show>
        </Show>

        <Show when={prefs.value.changes}>
          <Section
            title={ctx.t("panel.changes")}
            count={diffs()?.length === undefined ? undefined : `${changeTotals().files} · +${formatNumber(changeTotals().additions)} −${formatNumber(changeTotals().deletions)}`}
          >
            <Show when={diffs()} fallback={<ui.Loader size="small" />}>
              {(list) => (
                <Show when={list().length > 0} fallback={<div class="wb-empty">{ctx.t("panel.noChanges")}</div>}>
                  <For each={list().slice(0, 8)}>
                    {(item) => <ChangeRow change={item} onClick={() => focusChange(item.file)} />}
                  </For>
                  <Show when={list().length > 8}>
                    <ui.Button size="small" variant="ghost-muted" onClick={openChanges}>
                      {ctx.t("panel.showReview")}
                    </ui.Button>
                  </Show>
                </Show>
              )}
            </Show>
          </Section>
        </Show>

        <Show when={prefs.value.tasks}>
          <Section title={ctx.t("panel.tasks")} count={props.session.background.length}>
            <Show
              when={props.session.background.length > 0}
              fallback={<div class="wb-empty">{ctx.t("panel.noTasks")}</div>}
            >
              <For each={props.session.background}>
                {(task) => (
                  <div class="wb-row">
                    <ui.Icon name={task.type === "subagent" ? "brain" : "terminal"} size="small" class="wb-faint" />
                    <div class="wb-row-main">
                      <span class="wb-row-title">
                        <span class="truncate">{task.label}</span>
                      </span>
                      <span class="wb-row-detail">
                        <span>{task.type === "subagent" ? task.agent ?? "subagent" : "shell"}</span>
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Section>
        </Show>

        <Show when={prefs.value.connectors}>
          <Section title={ctx.t("panel.connectors")} count={connectors().length}>
            <Show when={connectors().length > 0} fallback={<div class="wb-empty">{ctx.t("panel.noConnectors")}</div>}>
              <For each={connectors()}>{(server) => <ConnectorRow server={server} />}</For>
            </Show>
          </Section>
        </Show>

        <Show when={prefs.value.context}>
          <Section title={ctx.t("panel.context")}>
            <div class="wb-row">
              <ui.Icon name="brain" size="small" class="wb-faint" />
              <div class="wb-row-main">
                <span class="wb-row-title">
                  <span>{context().limit ? `${context().pct}%` : ctx.t("panel.loading")}</span>
                  <span class="wb-faint">
                    {formatNumber(context().used)}
                    {context().limit ? ` / ${formatNumber(context().limit!)}` : ""} tokens
                  </span>
                </span>
                <div class="wb-meter">
                  <div class="wb-meter-fill" style={{ width: `${context().pct}%` }} />
                </div>
                <span class="wb-row-detail">${context().cost.toFixed(2)}</span>
              </div>
            </div>
          </Section>
        </Show>

        <Show when={prefs.value.issues}>
          <Section title={ctx.t("panel.issues")} count={issues().length}>
            <Show when={issues().length > 0} fallback={<div class="wb-empty">{ctx.t("panel.noIssues")}</div>}>
              <For each={issues()}>
                {(issue) => (
                  <button
                    type="button"
                    class="wb-row clickable"
                    onClick={() => ctx.system.openExternal(issue.url)}
                  >
                    <ui.Icon name="circle-exclamation" size="small" class="wb-warn" />
                    <span class="wb-row-main">
                      <span class="wb-row-title">
                        <span class="truncate">
                          #{issue.number} {issue.title}
                        </span>
                      </span>
                      <span class="wb-row-detail">{relativeTime(issue.updatedAt)}</span>
                    </span>
                  </button>
                )}
              </For>
            </Show>
          </Section>
        </Show>
      </div>
    </div>
  )
}

function Section(props: { title: string; count?: number | string; children: JSX.Element }) {
  return (
    <section class="wb-panel-section">
      <div class="wb-section-head">
        <span>{props.title}</span>
        <Show when={props.count !== undefined}>
          <span class="wb-section-count">{props.count}</span>
        </Show>
      </div>
      {props.children}
    </section>
  )
}

function Workspace(props: {
  snapshot: Snapshot | undefined
  project: string
  directory: string
  onCopy: () => void
  onOpen: () => void
}) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const value = () => props.snapshot

  return (
    <div class="wb-row">
      <ui.Icon name="workspace" size="small" class="wb-faint" />
      <div class="wb-row-main">
        <span class="wb-row-title">
          <span class="truncate">{value()?.repo ?? props.project}</span>
          <Show when={value()?.dirty}>
            <span class="wb-badge wb-warn">{value()!.dirty} changed</span>
          </Show>
        </span>
        <span class="wb-row-detail">
          <ui.Icon name="branch" size="small" />
          <span>{value()?.branch ?? "HEAD"}</span>
          <Show when={(value()?.ahead ?? 0) + (value()?.behind ?? 0) > 0}>
            <span>
              ↑{value()?.ahead ?? 0} ↓{value()?.behind ?? 0}
            </span>
          </Show>
        </span>
        <span class="wb-row-detail wb-mono" title={props.directory}>
          {shortPath(props.directory)}
        </span>
      </div>
      <div class="wb-row-end">
        <ui.Tooltip value={ctx.t("panel.copy")}>
          <ui.IconButton icon="copy" label={ctx.t("panel.copy")} size="small" variant="ghost-muted" onClick={props.onCopy} />
        </ui.Tooltip>
        <ui.Tooltip value={ctx.t("panel.open")}>
          <ui.IconButton icon="layout-right" label={ctx.t("panel.open")} size="small" variant="ghost-muted" onClick={props.onOpen} />
        </ui.Tooltip>
      </div>
    </div>
  )
}

function PullRow(props: {
  pull: PullRequest
  onOpen: () => void
  onCopy: () => void
  onMerge: () => void
}) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const pull = () => props.pull

  return (
    <div class="wb-row">
      <button type="button" class="wb-row-main wb-row-button" onClick={props.onOpen}>
        <span class="wb-row-title">
          <span class="truncate">
            #{pull().number} {pull().title}
          </span>
          <Show when={pull().draft}>
            <span class="wb-badge">{ctx.t("panel.draft")}</span>
          </Show>
        </span>
        <span class="wb-row-detail">
          <span>{pull().author ?? "unknown"}</span>
          <span>·</span>
          <span>{pull().branch}</span>
          <Show when={relativeTime(pull().updatedAt)}>
            {(time) => (
              <>
                <span>·</span>
                <span>{time()}</span>
              </>
            )}
          </Show>
        </span>
      </button>
      <div class="wb-row-end">
        <ui.Tooltip value={ctx.t(`panel.checks.${pull().checks}`)}>
          <span class={toneClass(checksTone(pull().checks))}>
            <ui.Icon name={checksIcon(pull().checks)} size="small" />
          </span>
        </ui.Tooltip>
        <ui.Tooltip value={ctx.t(`panel.review.${pull().review}`)}>
          <span class={toneClass(reviewTone(pull().review))}>
            <ui.Icon name={reviewIcon(pull().review)} size="small" />
          </span>
        </ui.Tooltip>
        <ui.Tooltip value={ctx.t("panel.merge")}>
          <span class={toneClass(mergeTone(pull().mergeable))}>
            <ui.Icon name={mergeIcon(pull().mergeable)} size="small" />
          </span>
        </ui.Tooltip>
        <ui.Menu
          label={ctx.t("panel.pulls")}
          trigger="icon"
          icon="outline-dots"
          items={[
            { label: ctx.t("panel.openGithub"), icon: "github", onSelect: props.onOpen },
            { label: ctx.t("panel.copy"), icon: "copy", onSelect: props.onCopy },
            ...(pull().state === "OPEN"
              ? [
                  { type: "separator" as const },
                  { label: ctx.t("panel.merge"), icon: "fork" as const, onSelect: props.onMerge },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  )
}

function ChangeRow(props: { change: Change; onClick: () => void }) {
  return (
    <button type="button" class="wb-row clickable" onClick={props.onClick}>
      <span class="wb-faint">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="3" fill="currentColor" />
        </svg>
      </span>
      <span class="wb-row-main">
        <span class="wb-row-title">
          <span class="truncate">{props.change.file}</span>
        </span>
        <span class="wb-row-detail">
          <span class="wb-ok">+{props.change.additions}</span>
          <span class="wb-bad">−{props.change.deletions}</span>
        </span>
      </span>
    </button>
  )
}

function ConnectorRow(props: { server: McpServer }) {
  const status = () => props.server.status.status

  const icon = () => {
    if (status() === "connected") return "circle-check"
    if (status() === "failed") return "circle-x"
    if (status() === "needs_auth") return "lock"
    if (status() === "pending") return "circle-exclamation"
    return "dash"
  }

  const tone = () => {
    if (status() === "connected") return "wb-ok"
    if (status() === "failed") return "wb-bad"
    if (status() === "needs_auth" || status() === "pending") return "wb-warn"
    return "wb-faint"
  }

  return (
    <div class="wb-row">
      <span class={tone()}>
        <McpIcon name={icon()} />
      </span>
      <div class="wb-row-main">
        <span class="wb-row-title">
          <span class="truncate">{props.server.title || props.server.name}</span>
        </span>
        <span class="wb-row-detail">
          <span>{status()}</span>
          <Show when={"error" in props.server.status}>
            <span class="truncate">{props.server.status.error}</span>
          </Show>
        </span>
      </div>
    </div>
  )
}

function McpIcon(props: { name: IconName }) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui

  return <ui.Icon name={props.name} size="small" />
}
