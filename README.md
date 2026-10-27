# opencode-workbench

A GUI plugin for OpenCode Desktop 2.2 that adds an environment view, GitHub pull request actions, project-sorted tabs, and a Claude-style token skin.

It is a local plugin package: one server part for `gh`/Git data, one GUI part for the surfaces.

## What it adds

- A `window.bottom` status line with project, branch, current PR, changed files, background tasks, context use and a refresh action.
- A pinned **Environment** tab in the session side panel: workspace, pull requests, assigned issues, working-tree changes, background tasks, MCP connectors and context usage.
- A PR pill above the composer, with one row per open pull request.
- Pull request creation and merge, each behind a confirmation dialog.
- A `Sort tabs by project` command, plus optional auto-grouping.
- A command to switch interface mode, wired to upstream `view.inbox` / `view.tabs` when present.
- An optional Claude-style token skin: warm near-black surfaces, clay accent, monospace UI, flatter borders.

The ambient background (image, dither, ASCII, pixelation) is deliberately not in this first build. It needs a separate surface-transparency spike.

## Install

The desktop app reads GUI plugins from the global `opencode.json(c)` only.

```jsonc
{
  "plugins": ["/Users/henrik/Dev/Repos/opencode-plugins/packages/workbench"]
}
```

Then reload OpenCode Desktop, or use **Settings → Extensions → Plugins**. A local directory resolves through its `package.json` `name` and `exports`; the bundle must exist before the app reads it.

```bash
cd /Users/henrik/Dev/Repos/opencode-plugins
bun install
bun run build
```

For development, keep a Vite watcher running. Each rebuild reloads the GUI in every window; the server part does not restart on a GUI rebuild.

```bash
bun run dev
```

## Commands

| Command | Default shortcut | Notes |
|---|---|---|
| `workbench.environment` | `mod+shift+e` | Opens/toggles the Environment panel |
| `workbench.refresh` | — | Force a refresh of the routed session |
| `workbench.createPull` | — | Opens the create-PR dialog |
| `workbench.sortTabs` | — | Groups open shell tabs by project |
| `workbench.inbox` | — | Calls upstream `view.inbox` if installed, else opens Settings → General |
| `workbench.tabs` | — | Calls upstream `view.tabs` if installed, else opens Settings → General |
| `workbench.interface` | — | Calls upstream `view.interfaceMode` if installed, else opens Settings → General |
| `workbench.skin` | — | Toggles the Claude token skin |
| `workbench.settings` | — | Opens the Workbench settings page |

All commands are published in **Settings → Shortcuts**, so you can assign your own keys.

## Settings

- **General** — enable Workbench, status line, panel, PR pill.
- **GitHub** — `gh` path, all open PRs vs ten, assigned issues, refresh interval, default merge method, delete-branch default.
- **Panel** — pull requests, changes, background tasks, connectors, context usage.
- **Tabs** — auto-group tabs by project, sort now.
- **Appearance** — Claude skin.
- **Actions** — open the panel, refresh all watched directories.

## GitHub behaviour

- Reads use the `gh` CLI and your existing `gh auth` keyring. No token is stored by the plugin.
- `gh` is resolved from the configured path, `WORKBENCH_GH`, Homebrew's `/opt/homebrew/bin/gh`, `/usr/local/bin/gh`, `/usr/bin/gh`, then `PATH`.
- Creating a PR can push the branch first; the dialog exposes that as a switch.
- Merging requires a confirmation dialog, a merge method, and optionally deletes the branch.
- If `gh` is missing or not signed in, the panel shows the reason and offers the relevant action. It never silently falls back.
- Reads are cached for 20 seconds; `gh auth status` is cached for 60 seconds.

## Development checks

```bash
bun run typecheck
bun test
bun run build
bun run smoke /Users/henrik/Dev/Repos/rista
```

The smoke script calls the server resolver directly and prints the snapshot. It is read-only.

## Known limits

- The GUI plugin API is experimental. Pin `@opencode/plugin@2.2.0` to OpenCode 2.2.
- The Claude skin uses internal `--v2-*` tokens and `data-component` attributes. It is opt-in for that reason; disable it if an app update breaks it.
- The Environment panel is a session side-panel tab, not a permanent third column. The status line is the always-visible surface.
- Sorting applies to open shell tabs (the vertical rail in side-tabs mode), not to the experimental Inbox list.
- The Inbox and vertical-tab switch needs the upstream command described in `docs/upstream-interface-command.md`. Until then the commands open Settings → General.
- Create/merge were not exercised against a live repository during development, to avoid changing remote state. The read path was smoke-tested on real repositories.
