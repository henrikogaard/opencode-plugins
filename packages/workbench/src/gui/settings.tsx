import { Show } from "solid-js"
import type { JSX } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import type { WorkbenchState } from "./state"

export function WorkbenchSettings(props: { state: WorkbenchState }) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const prefs = ctx.stores.prefs

  const setEnabled = (value: boolean) => prefs.update((draft) => void (draft.enabled = value))
  const setStatusLine = (value: boolean) => prefs.update((draft) => void (draft.statusLine = value))
  const setPanel = (value: boolean) => prefs.update((draft) => void (draft.panel = value))
  const setPill = (value: boolean) => prefs.update((draft) => void (draft.pill = value))
  const setSkin = (value: boolean) => prefs.update((draft) => void (draft.skin = value))
  const setPrs = (value: boolean) => prefs.update((draft) => void (draft.prs = value))
  const setIssues = (value: boolean) => prefs.update((draft) => void (draft.issues = value))
  const setChanges = (value: boolean) => prefs.update((draft) => void (draft.changes = value))
  const setSubagents = (value: boolean) => prefs.update((draft) => void (draft.subagents = value))
  const setTasks = (value: boolean) => prefs.update((draft) => void (draft.tasks = value))
  const setConnectors = (value: boolean) => prefs.update((draft) => void (draft.connectors = value))
  const setContext = (value: boolean) => prefs.update((draft) => void (draft.context = value))
  const setIncludeAll = (value: boolean) => prefs.update((draft) => void (draft.includeAll = value))
  const setDeleteBranch = (value: boolean) => prefs.update((draft) => void (draft.deleteBranch = value))
  const setAutoGroup = (value: boolean) => prefs.update((draft) => void (draft.autoGroup = value))

  const sortNow = () => {
    const count = props.state.sortTabs()
    ctx.toast.show({
      title: count > 0 ? ctx.t("command.sorted") : ctx.t("command.sortNothing"),
      description: count > 0 ? ctx.t("command.sorted.description", { count }) : ctx.t("command.sortNothing.description"),
    })
  }

  return (
    <div class="wb-settings">
      <Section title={ctx.t("settings.section.general")}>
        <Row
          label={ctx.t("settings.enabled")}
          description={ctx.t("settings.enabled.description")}
          control={<ui.Switch label={ctx.t("settings.enabled")} hideLabel checked={prefs.value.enabled} onChange={setEnabled} />}
        />
        <Row
          label={ctx.t("settings.statusLine")}
          description={ctx.t("settings.statusLine.description")}
          control={
            <ui.Switch
              label={ctx.t("settings.statusLine")}
              hideLabel
              checked={prefs.value.statusLine}
              onChange={setStatusLine}
            />
          }
        />
        <Row
          label={ctx.t("settings.panel")}
          description={ctx.t("settings.panel.description")}
          control={<ui.Switch label={ctx.t("settings.panel")} hideLabel checked={prefs.value.panel} onChange={setPanel} />}
        />
        <Row
          label={ctx.t("settings.pill")}
          description={ctx.t("settings.pill.description")}
          control={<ui.Switch label={ctx.t("settings.pill")} hideLabel checked={prefs.value.pill} onChange={setPill} />}
        />
      </Section>

      <Section title={ctx.t("settings.section.github")}>
        <ui.TextInput
          label={ctx.t("settings.ghPath")}
          placeholder="gh"
          value={prefs.value.ghPath}
          onInput={(value) => prefs.update((draft) => void (draft.ghPath = value))}
          onSubmit={() => props.state.refreshAll()}
        />
        <div class="wb-settings-description">{ctx.t("settings.ghPath.description")}</div>

        <Row
          label={ctx.t("settings.includeAll")}
          description={ctx.t("settings.includeAll.description")}
          control={
            <ui.Switch
              label={ctx.t("settings.includeAll")}
              hideLabel
              checked={prefs.value.includeAll}
              onChange={setIncludeAll}
            />
          }
        />
        <Row
          label={ctx.t("settings.issues")}
          description={ctx.t("settings.issues.description")}
          control={<ui.Switch label={ctx.t("settings.issues")} hideLabel checked={prefs.value.issues} onChange={setIssues} />}
        />

        <Row
          label={ctx.t("settings.refresh")}
          description={ctx.t("settings.refresh.description")}
          control={
            <select
              class="wb-select"
              value={String(prefs.value.refreshSeconds)}
              onChange={(event) =>
                prefs.update((draft) => void (draft.refreshSeconds = Number(event.currentTarget.value)))
              }
            >
              <option value="0">Off</option>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="120">120s</option>
            </select>
          }
        />

        <Row
          label={ctx.t("settings.mergeMethod")}
          control={
            <select
              class="wb-select"
              value={prefs.value.mergeMethod}
              onChange={(event) =>
                prefs.update(
                  (draft) =>
                    void (draft.mergeMethod = event.currentTarget.value as "merge" | "squash" | "rebase"),
                )
              }
            >
              <option value="squash">squash</option>
              <option value="merge">merge</option>
              <option value="rebase">rebase</option>
            </select>
          }
        />

        <Row
          label={ctx.t("settings.deleteBranch")}
          description={ctx.t("settings.deleteBranch.description")}
          control={
            <ui.Switch
              label={ctx.t("settings.deleteBranch")}
              hideLabel
              checked={prefs.value.deleteBranch}
              onChange={setDeleteBranch}
            />
          }
        />
      </Section>

      <Section title={ctx.t("settings.section.panel")}>
        <Row
          label={ctx.t("settings.prs")}
          control={<ui.Switch label={ctx.t("settings.prs")} hideLabel checked={prefs.value.prs} onChange={setPrs} />}
        />
        <Row
          label={ctx.t("settings.subagents")}
          control={
            <ui.Switch
              label={ctx.t("settings.subagents")}
              hideLabel
              checked={prefs.value.subagents}
              onChange={setSubagents}
            />
          }
        />
        <Row
          label={ctx.t("settings.changes")}
          control={<ui.Switch label={ctx.t("settings.changes")} hideLabel checked={prefs.value.changes} onChange={setChanges} />}
        />
        <Row
          label={ctx.t("settings.tasks")}
          control={<ui.Switch label={ctx.t("settings.tasks")} hideLabel checked={prefs.value.tasks} onChange={setTasks} />}
        />
        <Row
          label={ctx.t("settings.connectors")}
          control={
            <ui.Switch
              label={ctx.t("settings.connectors")}
              hideLabel
              checked={prefs.value.connectors}
              onChange={setConnectors}
            />
          }
        />
        <Row
          label={ctx.t("settings.context")}
          control={<ui.Switch label={ctx.t("settings.context")} hideLabel checked={prefs.value.context} onChange={setContext} />}
        />
      </Section>

      <Section title={ctx.t("settings.section.tabs")}>
        <Row
          label={ctx.t("settings.autoGroup")}
          description={ctx.t("settings.autoGroup.description")}
          control={
            <ui.Switch
              label={ctx.t("settings.autoGroup")}
              hideLabel
              checked={prefs.value.autoGroup}
              onChange={setAutoGroup}
            />
          }
        />
        <div class="wb-settings-actions">
          <ui.Button size="small" variant="neutral" icon="branch" onClick={sortNow}>
            {ctx.t("settings.sortNow")}
          </ui.Button>
        </div>
      </Section>

      <Section title={ctx.t("settings.section.appearance")}>
        <Row
          label={ctx.t("settings.skin")}
          description={ctx.t("settings.skin.description")}
          control={<ui.Switch label={ctx.t("settings.skin")} hideLabel checked={prefs.value.skin} onChange={setSkin} />}
        />
      </Section>

      <Section title={ctx.t("settings.section.actions")}>
        <div class="wb-settings-actions">
          <ui.Button
            size="small"
            variant="neutral"
            icon="layout-right"
            onClick={() => props.state.openPanel()}
          >
            {ctx.t("settings.openPanel")}
          </ui.Button>
          <ui.Button size="small" variant="ghost-muted" icon="refresh" onClick={() => props.state.refreshAll()}>
            {ctx.t("settings.refreshNow")}
          </ui.Button>
        </div>
      </Section>
    </div>
  )
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="wb-settings-section">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  )
}

function Row(props: { label: string; description?: string; control: JSX.Element }) {
  return (
    <div class="wb-settings-row">
      <div class="wb-settings-copy">
        <div class="wb-settings-label">{props.label}</div>
        <Show when={props.description}>
          <div class="wb-settings-description">{props.description}</div>
        </Show>
      </div>
      <div class="wb-settings-control">{props.control}</div>
    </div>
  )
}
