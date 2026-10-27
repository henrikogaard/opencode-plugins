import type { ComposerPill, ComposerPillTone, MountedSession, SetupContext } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { checksIcon, checksTone } from "./icons"
import type { PullRequest } from "../rpc"
import type { WorkbenchState } from "./state"

export function createPullPill(ctx: SetupContext<typeof definition>, state: WorkbenchState): ComposerPill {
  return {
    id: "pulls",
    order: 20,
    show: (input) => {
      if (!ctx.stores.prefs.value.pill) return undefined

      const session: MountedSession = input.session
      const directory = session.directory
      state.ensure(directory)

      const snapshot = state.snapshot(directory)
      if (!snapshot || snapshot.prs.length === 0) return undefined

      const current = snapshot.current
      const tone: ComposerPillTone | undefined = current
        ? checksTone(current.checks)
        : snapshot.prs.some((pull) => pull.checks === "failure")
          ? "danger"
          : undefined

      return {
        icon: "github",
        label: current ? `PR #${current.number}` : `${snapshot.prs.length} PRs`,
        tone,
        title: ctx.t("panel.pulls"),
        rows: [
          ...snapshot.prs
            .slice()
            .sort((a: PullRequest, b: PullRequest) => {
              if (a.number === current?.number) return -1
              if (b.number === current?.number) return 1
              if (a.checks === "failure" && b.checks !== "failure") return -1
              if (b.checks === "failure" && a.checks !== "failure") return 1
              return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
            })
            .map((pull: PullRequest) => ({
              id: String(pull.number),
              label: `${pull.draft ? "◌ " : ""}#${pull.number} ${pull.title}`,
              icon: checksIcon(pull.checks),
              tone: checksTone(pull.checks),
              detail: pull.branch,
              run: () => ctx.system.openExternal(pull.url),
            })),
          {
            id: "environment",
            label: ctx.t("panel.open"),
            icon: "layout-right" as const,
            run: () => state.openPanel(session),
          },
        ],
      }
    },
  }
}
