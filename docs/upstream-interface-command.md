# Upstream interface-mode commands

The app already has the three layouts and the setter:

- `settings.appearance.tabLayout()` is `"horizontal" | "vertical" | "inbox"`.
- `settings.appearance.setTabLayout(value)` changes it.
- The setting is rendered by `app/src/settings/general/interface-mode.tsx`.

What is missing is a command-palette/keybind entry. The Workbench plugin already tries these IDs:

- `view.inbox` → `setTabLayout("inbox")`
- `view.tabs` → `setTabLayout("vertical")`
- `view.interfaceMode` → optional cycle command

If none exists, `workbench.inbox` and `workbench.tabs` open **Settings → General** and explain why.

## Suggested upstream change

Register two commands next to the existing view commands, both enabled when the app interface is mounted:

```ts
{
  id: "view.inbox",
  title: language.t("command.view.inbox"),
  group: language.t("command.category.view"),
  section: "navigation",
  run: () => settings.appearance.setTabLayout("inbox"),
},
{
  id: "view.tabs",
  title: language.t("command.view.tabs"),
  group: language.t("command.category.view"),
  section: "navigation",
  run: () => settings.appearance.setTabLayout("vertical"),
},
```

Add copy such as:

```json
{
  "command.view.inbox": "Switch to inbox",
  "command.view.tabs": "Switch to vertical tabs"
}
```

Optionally bind them. `mod+shift+i` and `mod+shift+v` are suggestions; verify they do not collide with an existing shortcut before assigning defaults.

That is the whole change. No plugin API is needed; once the commands exist, any plugin or the user can bind them, and `workbench.inbox` / `workbench.tabs` start working immediately.

## Why not a plugin workaround

A plugin can open Settings, but it cannot write app settings. Its storage is namespaced to the plugin. Driving the settings radio by DOM click is brittle, requires the settings page to be mounted, and would break on a UI update. The command belongs upstream.
