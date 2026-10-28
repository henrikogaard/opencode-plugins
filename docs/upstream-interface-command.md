# Upstream interface-mode commands

The app already has the three layouts and the setter:

- `settings.appearance.tabLayout()` is `"horizontal" | "vertical" | "inbox"`.
- `settings.appearance.setTabLayout(value)` changes it.
- The setting is rendered by `app/src/settings/general/interface-mode.tsx`.

The missing piece is a command-palette/keybind entry. The Workbench plugin calls these IDs:

- `view.inbox` → `setTabLayout("inbox")`
- `view.tabs` → `setTabLayout("vertical")`

## Status

Proposed and implemented upstream:

- Feature request: https://github.com/anomalyco/opencode/issues/59853
- Pull request: https://github.com/anomalyco/opencode/pull/59854 (branch `interface-mode-commands` on `henrikogaard/opencode`)

Until a release ships the commands, `workbench.inbox` and `workbench.tabs` open **Settings → General** and explain why. Once the app provides `view.inbox` / `view.tabs`, the same Workbench commands switch immediately, and the shortcuts can be bound in **Settings → Shortcuts**.

## The change

Register two commands next to the other view commands, with no default keybinds:

```ts
command.register("interface-mode", () => [
  {
    id: "view.tabs",
    title: language.t("command.view.tabs"),
    category: language.t("command.category.view"),
    onSelect: () => preferences.appearance.setTabLayout("vertical"),
  },
  {
    id: "view.inbox",
    title: language.t("command.view.inbox"),
    category: language.t("command.category.view"),
    onSelect: () => preferences.appearance.setTabLayout("inbox"),
  },
])
```

Copy:

```json
{
  "command.view.tabs": "Switch to vertical tabs",
  "command.view.inbox": "Switch to inbox"
}
```

## Why not a plugin workaround

A plugin can open Settings, but it cannot write app settings. Its storage is namespaced to the plugin. Driving the settings radio by DOM click is brittle, requires the settings page to be mounted, and would break on a UI update. The command belongs upstream.
