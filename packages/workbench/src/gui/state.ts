import { createEffect, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { MountedSession, SetupContext } from "@opencode/plugin/gui"
import { Workbench, type MutationOutput, type Snapshot } from "../rpc"
import type { definition } from "./definition"
import { sortTabsByProject } from "./tabs"

export interface CreatePullValues {
  title: string
  body: string
  base?: string
  draft?: boolean
  push?: boolean
}

export interface MergePullValues {
  number: number
  method: "merge" | "squash" | "rebase"
  deleteBranch?: boolean
}

export interface WorkbenchState {
  snapshot(directory: string | undefined): Snapshot | undefined
  loading(directory: string | undefined): boolean
  error(directory: string | undefined): string | undefined
  current(): Snapshot | undefined
  currentSession(): MountedSession | undefined
  ensure(directory: string): void
  watch(directory: string): void
  refresh(directory: string, force?: boolean): Promise<void>
  refreshAll(): void
  openPanel(session?: MountedSession): void
  createPull(session: MountedSession, input: CreatePullValues): Promise<MutationOutput>
  mergePull(session: MountedSession, input: MergePullValues): Promise<MutationOutput>
  sortTabs(): number
  toggleSkin(): void
  openSettings(): void
}

export function createWorkbench(ctx: SetupContext<typeof definition>): WorkbenchState {
  const prefs = ctx.stores.prefs
  const [snapshots, setSnapshots] = createStore<Record<string, Snapshot | undefined>>({})
  const [loading, setLoading] = createStore<Record<string, boolean>>({})
  const [errors, setErrors] = createStore<Record<string, string | undefined>>({})

  const last = new Map<string, number>()
  const inflight = new Map<string, Promise<void>>()
  const watched = new Map<string, number>()

  const interval = () => Math.max(0, prefs.value.refreshSeconds || 0)

  const load = (directory: string, force = false): Promise<void> => {
    if (!directory) return Promise.resolve()

    const previous = inflight.get(directory)
    if (previous) return previous

    const now = Date.now()
    if (!force && now - (last.get(directory) ?? 0) < 8_000) return Promise.resolve()

    const task = (async () => {
      setLoading(directory, true)

      try {
        const result = (await ctx.client.rpc(Workbench).snapshot(
          {
            directory,
            ghPath: prefs.value.ghPath.trim() || undefined,
            includeAll: prefs.value.includeAll,
            includeIssues: prefs.value.issues,
            refresh: force,
          },
          { location: { directory } },
        )) as Snapshot

        setSnapshots(directory, result)
        setErrors(directory, result.error)
        last.set(directory, Date.now())
      } catch (cause) {
        setErrors(directory, cause instanceof Error ? cause.message : String(cause))
      } finally {
        setLoading(directory, false)
        inflight.delete(directory)
      }
    })()

    inflight.set(directory, task)
    return task
  }

  const watch = (directory: string) => {
    const count = watched.get(directory) ?? 0
    watched.set(directory, count + 1)

    if (count === 0) void load(directory)

    onCleanup(() => {
      const next = (watched.get(directory) ?? 1) - 1
      if (next <= 0) watched.delete(directory)
      else watched.set(directory, next)
    })
  }

  const ensure = (directory: string) => {
    if (!snapshots[directory]) {
      void load(directory)
      return
    }

    if (Date.now() - (last.get(directory) ?? 0) > 60_000) void load(directory)
  }

  const timer = window.setInterval(() => {
    const seconds = interval()
    if (!seconds) return

    const now = Date.now()
    for (const directory of watched.keys()) {
      if (now - (last.get(directory) ?? 0) >= seconds * 1_000) void load(directory)
    }
  }, 5_000)

  onCleanup(() => clearInterval(timer))

  createEffect(
    on(
      () => `${prefs.value.includeAll}\0${prefs.value.issues}`,
      () => {
        for (const directory of watched.keys()) void load(directory, true)
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    const root = document.documentElement
    if (prefs.value.skin) root.dataset.workbenchSkin = "claude"
    else delete root.dataset.workbenchSkin
  })

  onCleanup(() => {
    delete document.documentElement.dataset.workbenchSkin
  })

  const openPanel = (session?: MountedSession) => {
    const target = session ?? ctx.sessions.current()
    if (!target) {
      ctx.toast.show({ title: ctx.t("command.noSession") })
      return
    }

    const key = `${ctx.id}:environment`
    ctx.layout.open(key, target, { tab: "select" })

    if (!ctx.layout.side.opened(target)) ctx.layout.side.toggle(target)
  }

  const createPull = async (session: MountedSession, input: CreatePullValues): Promise<MutationOutput> => {
    const result = (await ctx.client.rpc(Workbench).createPull(
      {
        ...input,
        directory: session.directory,
        ghPath: prefs.value.ghPath.trim() || undefined,
      },
      { location: { directory: session.directory } },
    )) as MutationOutput

    if (result.ok) await load(session.directory, true)
    return result
  }

  const mergePull = async (session: MountedSession, input: MergePullValues): Promise<MutationOutput> => {
    const result = (await ctx.client.rpc(Workbench).mergePull(
      {
        ...input,
        directory: session.directory,
        ghPath: prefs.value.ghPath.trim() || undefined,
      },
      { location: { directory: session.directory } },
    )) as MutationOutput

    if (result.ok) await load(session.directory, true)
    return result
  }

  return {
    snapshot: (directory) => (directory ? snapshots[directory] : undefined),
    loading: (directory) => (directory ? (loading[directory] ?? false) : false),
    error: (directory) => (directory ? errors[directory] : undefined),
    current: () => {
      const directory = ctx.sessions.current()?.directory
      return directory ? snapshots[directory] : undefined
    },
    currentSession: () => ctx.sessions.current(),
    ensure,
    watch,
    refresh: (directory, force = true) => load(directory, force),
    refreshAll: () => {
      for (const directory of watched.keys()) void load(directory, true)
    },
    openPanel,
    createPull,
    mergePull,
    sortTabs: () => sortTabsByProject(ctx),
    toggleSkin: () => {
      prefs.update((draft) => {
        draft.skin = !draft.skin
      })
    },
    openSettings: () => ctx.layout.settings("workbench"),
  }
}
