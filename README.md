# opencode-workbench

A GUI plugin for OpenCode Desktop 2.2 that adds an environment view, GitHub pull request actions, project-sorted tabs, and a Claude-style token skin.

It is a local plugin package: one server part for `gh`/Git data, one GUI part for the surfaces.

## What it adds

- A `window.bottom` status line with project, branch, current PR, changed files, background tasks, context use and a refresh action.
- A pinned **Environment** tab in the session side panel: workspace, pull requests, assigned issues, working-tree changes, a live subagent tree, background tasks, MCP connectors and context usage.
- A **Subagents** section that walks the session family depth-first: title, agent, model, elapsed time, tokens, cost, running/approval/input/failed state, and a click to open the subagent. The status line shows the running/total count.
- A PR pill above the composer, with one row per open pull request.
- Pull request creation and merge, each behind a confirmation dialog.
- A `Sort tabs by project` command, plus optional auto-grouping.
- A command to switch interface mode, wired to upstream `view.inbox` / `view.tabs` when present.
- An optional Claude-style token skin: warm near-black surfaces, clay accent, monospace UI, flatter borders.
- An optional ambient background layer: ordered dithering, coarse pixels, an ASCII field, or a drifting image, cycled with the `workbench.ambient` command or configured in settings. The base surface becomes translucent while it runs; reduce-motion disables it.

The ambient background ships now: dither, ASCII, pixel and image modes, each slow and low-contrast by default.

## Install

Clone the repository and build the bundle:

```bash
git clone https://github.com/henrikogaard/opencode-plugins.git
cd opencode-plugins
bun install
bun run build
```

The desktop app reads GUI plugins from the global `opencode.json(c)` only. Add the package to your existing `plugins` array:

```jsonc
{
  "plugins": [
    "/absolute/path/to/opencode-plugins/packages/workbench"
  ]
}
```

Then reload OpenCode Desktop, or use **Settings → Extensions → Plugins**. A local directory resolves through its `package.json` `name` and `exports`; the bundle must exist before the app reads it.

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
| `workbench.ambient` | — | Cycles the ambient background: off → dither → ascii → pixel → image |
| `workbench.settings` | — | Opens the Workbench settings page |

All commands are published in **Settings → Shortcuts**, so you can assign your own keys.

## Settings

- **General** — enable Workbench, status line, panel, PR pill.
- **GitHub** — `gh` path, up to 50 open PRs vs ten, assigned issues, refresh interval, default merge method, delete-branch default.
- **Panel** — pull requests, subagents, changes, background tasks, connectors, context usage.
- **Tabs** — auto-group tabs by project, sort now.
- **Appearance** — Claude skin, ambient background (mode, intensity, speed, image), plus the cycle command.
- **Actions** — open the panel, refresh all watched directories.

## GitHub behaviour

- Reads use the `gh` CLI and your existing `gh auth` keyring. No token is stored by the plugin.
- `gh` is resolved from the configured path, `WORKBENCH_GH`, Homebrew's `/opt/homebrew/bin/gh`, `/usr/local/bin/gh`, `/usr/bin/gh`, then `PATH`.
- Creating a PR can push the branch first; the dialog exposes that as a switch.
- Merging requires a confirmation dialog, a merge method, and optionally deletes the branch.
- If `gh` is missing or not signed in, the panel shows the reason and offers the relevant action. It never silently falls back.
- Reads are cached for 20 seconds; `gh auth status` is cached for 60 seconds. Failed, aborted and timed-out reads are not cached, and failed auth checks are not cached.
- A successful push invalidates the snapshot immediately, even when PR creation then fails.
- Subagent trees are loaded recursively through `syncFamily`, so nested subagents are included in both the panel and the status line.

## Development checks

```bash
bun run typecheck
bun test
bun run build
bun run smoke /path/to/a/repo
```

The smoke script calls the server resolver directly and prints the snapshot. It is read-only.

The server part was also exercised end-to-end through a local `opencode serve` 2.2.0 instance and `client.rpc(Workbench).snapshot(...)` on a real repository. The desktop GUI bundle itself has not yet been loaded from this repository into a running app.

## Known limits

- The GUI plugin API is experimental. Pin `@opencode/plugin@2.2.0` to OpenCode 2.2.
- The Claude skin uses internal `--v2-*` tokens and `data-component` attributes. It is opt-in for that reason; disable it if an app update breaks it.
- While an ambient mode is on, the base surface is made translucent using an approximation of the theme's base color. Custom themes may shift slightly; the skin's own base color is preserved when both are active.
- The Environment panel is a session side-panel tab, not a permanent third column. The status line is the always-visible surface.
- Workbench is restricted to the desktop app's local server. A session on a remote server shows **Local only** and no PR data; its repository is not the same checkout as the local path.
- The PR list loads at most 50 open pull requests, GitHub's page limit. The setting is labeled accordingly; it is not a complete inventory for very large repositories.
- Sorting applies to open shell tabs (the vertical rail in side-tabs mode), not to the experimental Inbox list.
- The Inbox and vertical-tab switch needs the upstream command described in `docs/upstream-interface-command.md`. Until then the commands open Settings → General.
- Create/merge were not exercised against a live repository during development, to avoid changing remote state. The read path was smoke-tested on real repositories.
