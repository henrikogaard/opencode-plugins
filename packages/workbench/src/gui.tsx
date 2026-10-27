import {
  Command,
  ComposerPill,
  Panel,
  Plugin,
  SettingsPage,
  Slot,
  Style,
  type PanelTab,
} from "@opencode/plugin/gui"
import styles from "./gui/styles.css?inline"
import skin from "./gui/skin.css?inline"
import { definition } from "./gui/definition"
import { EnvironmentView } from "./gui/environment"
import { createPullPill } from "./gui/pr-pill"
import { WorkbenchSettings } from "./gui/settings"
import { StatusLine } from "./gui/status-line"
import { createWorkbench } from "./gui/state"
import { installAutoGroup } from "./gui/tabs"
import { openCreatePull } from "./gui/dialogs"

export default Plugin.define({
  ...definition,
  setup(ctx) {
    const state = createWorkbench(ctx)
    const prefs = ctx.stores.prefs

    ctx.add(Style, styles)
    ctx.add(Style, skin)

    const status: Slot = {
      at: "window.bottom",
      render: () => <StatusLine state={state} />,
    }

    ctx.add(Slot, () => (prefs.value.enabled && prefs.value.statusLine ? status : undefined))

    const tab: PanelTab = {
      id: "environment",
      get title() {
        return ctx.t("panel.title")
      },
      pinned: true,
      closable: false,
      fallback: true,
    }

    const panel: Panel = {
      id: "environment",
      region: "side",
      wide: true,
      mobile: {
        get title() {
          return ctx.t("panel.title")
        },
        order: 45,
        kind: "menu",
        icon: "branch",
      },
      list: () => [tab],
      render: (props) => <EnvironmentView state={state} session={props.session} screen={props.screen} />,
    }

    ctx.add(Panel, () => (prefs.value.enabled && prefs.value.panel ? panel : undefined))
    ctx.add(ComposerPill, () => (prefs.value.enabled && prefs.value.pill ? createPullPill(ctx, state) : undefined))

    ctx.add(
      Command,
      (): Command => ({
        id: "environment",
        title: ctx.t("command.environment"),
        group: ctx.t("command.category"),
        section: "general",
        bind: "mod+shift+e",
        slash: { name: "env", after: "open" },
        featured: true,
        enabled: prefs.value.enabled,
        run: () => state.openPanel(),
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "refresh",
        title: ctx.t("command.refresh"),
        group: ctx.t("command.category"),
        section: "general",
        enabled: prefs.value.enabled && !!ctx.sessions.current(),
        run: () => {
          const directory = ctx.sessions.current()?.directory
          if (directory) void state.refresh(directory, true)
        },
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "createPull",
        title: ctx.t("command.createPull"),
        group: ctx.t("command.category"),
        section: "general",
        slash: { name: "pr", after: "open" },
        enabled: prefs.value.enabled && !!ctx.sessions.current() && !!state.current()?.auth,
        run: () => {
          const session = ctx.sessions.current()
          if (session) openCreatePull(ctx, state, session, state.snapshot(session.directory))
        },
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "sortTabs",
        title: ctx.t("command.sortTabs"),
        group: ctx.t("command.category"),
        section: "navigation",
        enabled: prefs.value.enabled && ctx.tabs.list().length > 1,
        run: () => {
          const count = state.sortTabs()
          ctx.toast.show({
            title: count > 0 ? ctx.t("command.sorted") : ctx.t("command.sortNothing"),
            description:
              count > 0 ? ctx.t("command.sorted.description", { count }) : ctx.t("command.sortNothing.description"),
          })
        },
      }),
    )

    const switchInterface = (ids: readonly string[]) => {
      for (const id of ids) {
        if (ctx.commands.run(id)) return
      }

      ctx.layout.settings("general")
      ctx.toast.show({
        title: ctx.t("command.interface.title"),
        description: ctx.t("command.interface.description"),
      })
    }

    ctx.add(
      Command,
      (): Command => ({
        id: "inbox",
        title: ctx.t("command.inbox"),
        group: ctx.t("command.category"),
        section: "navigation",
        slash: { name: "inbox", after: "open" },
        enabled: prefs.value.enabled,
        run: () => switchInterface(["view.inbox"]),
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "tabs",
        title: ctx.t("command.tabs"),
        group: ctx.t("command.category"),
        section: "navigation",
        slash: { name: "tabs", after: "open" },
        enabled: prefs.value.enabled,
        run: () => switchInterface(["view.tabs", "view.verticalTabs"]),
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "interface",
        title: ctx.t("command.interface"),
        group: ctx.t("command.category"),
        section: "general",
        slash: { name: "interface", after: "open" },
        enabled: prefs.value.enabled,
        run: () => switchInterface(["view.interfaceMode"]),
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "skin",
        title: ctx.t("command.skin"),
        group: ctx.t("command.category"),
        section: "general",
        slash: { name: "skin" },
        enabled: true,
        run: () => {
          state.toggleSkin()
          ctx.toast.show({
            title: prefs.value.skin ? ctx.t("command.skin.on") : ctx.t("command.skin.off"),
          })
        },
      }),
    )

    ctx.add(
      Command,
      (): Command => ({
        id: "settings",
        title: ctx.t("command.settings"),
        group: ctx.t("command.category"),
        section: "general",
        enabled: true,
        run: () => state.openSettings(),
      }),
    )

    ctx.add(SettingsPage, {
      id: "workbench",
      icon: "workspace",
      get title() {
        return ctx.t("settings.title")
      },
      get entries() {
        return [
          { id: "general", title: ctx.t("settings.section.general"), keywords: "status line panel pill" },
          { id: "github", title: ctx.t("settings.section.github"), keywords: "gh pull request pr merge" },
          { id: "tabs", title: ctx.t("settings.section.tabs"), keywords: "sort project tabs" },
          { id: "appearance", title: ctx.t("settings.section.appearance"), keywords: "skin claude" },
        ]
      },
      render: () => <WorkbenchSettings state={state} />,
    })

    installAutoGroup(ctx)
  },
})
