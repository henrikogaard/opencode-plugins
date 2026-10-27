import { For, Show, createSignal } from "solid-js"
import type { DialogHandle, MountedSession, SetupContext } from "@opencode/plugin/gui"
import type { PullRequest, Snapshot } from "../rpc"
import type { definition } from "./definition"
import { humanizeBranch } from "./format"
import { checksIcon, checksTone, mergeIcon, mergeTone, reviewIcon, reviewTone, toneClass } from "./icons"
import type { WorkbenchState } from "./state"

type Ctx = SetupContext<typeof definition>

export function openCreatePull(
  ctx: Ctx,
  state: WorkbenchState,
  session: MountedSession,
  snapshot: Snapshot | undefined,
): void {
  ctx.dialogs.open((dialog) => (
    <CreatePullDialog ctx={ctx} state={state} session={session} snapshot={snapshot} dialog={dialog} />
  ))
}

function CreatePullDialog(props: {
  ctx: Ctx
  state: WorkbenchState
  session: MountedSession
  snapshot: Snapshot | undefined
  dialog: DialogHandle
}) {
  const ui = props.ctx.ui
  const branch = () => props.snapshot?.branch ?? ""
  const base = () => props.snapshot?.base ?? ""
  const [title, setTitle] = createSignal(humanizeBranch(branch()))
  const [body, setBody] = createSignal("")
  const [baseValue, setBaseValue] = createSignal(base())
  const [draft, setDraft] = createSignal(false)
  const [push, setPush] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const sameBranch = () => !!baseValue().trim() && baseValue().trim() === branch()

  const submit = async () => {
    if (busy() || !title().trim() || sameBranch()) return

    setBusy(true)
    setError(undefined)

    try {
      const result = await props.state.createPull(props.session, {
        title: title().trim(),
        body: body(),
        base: baseValue().trim() || undefined,
        draft: draft(),
        push: push(),
      })

      if (!result.ok) {
        setError(result.error ?? "Could not create the pull request.")
        return
      }

      props.ctx.toast.show({
        variant: "success",
        title: props.ctx.t("dialog.create.ok"),
        description: result.url,
        actions: result.url
          ? [{ label: props.ctx.t("dialog.create.open"), run: () => props.ctx.system.openExternal(result.url!) }]
          : undefined,
      })

      props.dialog.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ui.Dialog
      title={props.ctx.t("dialog.create.title")}
      description={props.ctx.t("dialog.create.description", {
        branch: branch() || "HEAD",
        base: baseValue() || "the default branch",
      })}
      size="large"
      footer={
        <>
          <ui.Button variant="ghost" onClick={props.dialog.close}>
            {props.ctx.t("dialog.cancel")}
          </ui.Button>
          <ui.Button
            variant="contrast"
            busy={busy()}
            disabled={!title().trim() || busy() || sameBranch()}
            onClick={() => void submit()}
          >
            {busy() ? props.ctx.t("dialog.create.busy") : props.ctx.t("dialog.create.submit")}
          </ui.Button>
        </>
      }
    >
      <div class="wb-dialog-form">
        <Show when={error()}>
          {(message) => <div class="wb-error">{message()}</div>}
        </Show>

        <Show when={sameBranch()}>
          <p class="wb-dialog-note wb-warn">{props.ctx.t("dialog.create.sameBranch")}</p>
        </Show>

        <ui.TextInput
          label={props.ctx.t("dialog.create.titleLabel")}
          value={title()}
          onInput={setTitle}
          onSubmit={() => void submit()}
          autofocus
        />

        <ui.TextInput
          label={props.ctx.t("dialog.create.baseLabel")}
          placeholder="default"
          value={baseValue()}
          onInput={setBaseValue}
        />

        <label class="wb-settings-label" for="wb-create-body">
          {props.ctx.t("dialog.create.bodyLabel")}
        </label>
        <textarea
          id="wb-create-body"
          class="wb-textarea"
          value={body()}
          onInput={(event) => setBody(event.currentTarget.value)}
        />

        <ui.Switch checked={draft()} onChange={setDraft} label={props.ctx.t("dialog.create.draft")} />
        <ui.Switch checked={push()} onChange={setPush} label={props.ctx.t("dialog.create.push")} />
      </div>
    </ui.Dialog>
  )
}

export function openMergePull(
  ctx: Ctx,
  state: WorkbenchState,
  session: MountedSession,
  pull: PullRequest,
  snapshot: Snapshot | undefined,
): void {
  ctx.dialogs.open((dialog) => (
    <MergePullDialog ctx={ctx} state={state} session={session} pull={pull} snapshot={snapshot} dialog={dialog} />
  ))
}

function MergePullDialog(props: {
  ctx: Ctx
  state: WorkbenchState
  session: MountedSession
  pull: PullRequest
  snapshot: Snapshot | undefined
  dialog: DialogHandle
}) {
  const ui = props.ctx.ui
  const [method, setMethod] = createSignal(props.ctx.stores.prefs.value.mergeMethod)
  const [deleteBranch, setDeleteBranch] = createSignal(props.ctx.stores.prefs.value.deleteBranch)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const blocked = () => props.pull.state !== "OPEN" || props.pull.mergeable === "conflicting"

  const submit = async () => {
    if (busy() || blocked()) return

    setBusy(true)
    setError(undefined)

    try {
      const result = await props.state.mergePull(props.session, {
        number: props.pull.number,
        method: method(),
        deleteBranch: deleteBranch(),
      })

      if (!result.ok) {
        setError(result.error ?? "Could not merge the pull request.")
        return
      }

      props.ctx.toast.show({ variant: "success", title: props.ctx.t("dialog.merge.ok") })
      props.dialog.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ui.Dialog
      title={props.ctx.t("dialog.merge.title")}
      description={props.ctx.t("dialog.merge.description", {
        number: props.pull.number,
        base: props.pull.base || props.snapshot?.base || "main",
      })}
      size="normal"
      footer={
        <>
          <ui.Button variant="ghost" onClick={props.dialog.close}>
            {props.ctx.t("dialog.cancel")}
          </ui.Button>
          <ui.Button
            variant="danger"
            busy={busy()}
            disabled={blocked() || busy()}
            onClick={() => void submit()}
          >
            {busy() ? props.ctx.t("dialog.merge.busy") : props.ctx.t("dialog.merge.submit")}
          </ui.Button>
        </>
      }
    >
      <div class="wb-dialog-form">
        <Show when={error()}>
          {(message) => <div class="wb-error">{message()}</div>}
        </Show>

        <button type="button" class="wb-row clickable" onClick={() => props.ctx.system.openExternal(props.pull.url)}>
          <span class="wb-row-main">
            <span class="wb-row-title">
              <span class="truncate">
                #{props.pull.number} {props.pull.title}
              </span>
            </span>
            <span class="wb-row-detail">
              <ui.Icon name="github" size="small" />
              <span>{props.pull.branch}</span>
              <span>→</span>
              <span>{props.pull.base}</span>
            </span>
          </span>
          <span class="wb-row-end">
            <span class={toneClass(checksTone(props.pull.checks))}>
              <ui.Icon name={checksIcon(props.pull.checks)} size="small" />
            </span>
            <span class={toneClass(reviewTone(props.pull.review))}>
              <ui.Icon name={reviewIcon(props.pull.review)} size="small" />
            </span>
            <span class={toneClass(mergeTone(props.pull.mergeable))}>
              <ui.Icon name={mergeIcon(props.pull.mergeable)} size="small" />
            </span>
          </span>
        </button>

        <div class="wb-settings-label">{props.ctx.t("dialog.merge.method")}</div>
        <div class="wb-actions">
          <For each={["squash", "merge", "rebase"] as const}>
            {(value) => (
              <ui.Button
                size="small"
                variant={method() === value ? "contrast" : "neutral"}
                onClick={() => setMethod(value)}
              >
                {value}
              </ui.Button>
            )}
          </For>
        </div>

        <ui.Switch
          checked={deleteBranch()}
          onChange={setDeleteBranch}
          label={props.ctx.t("dialog.merge.delete")}
        />

        <p class="wb-dialog-note wb-warn">{props.ctx.t("dialog.merge.warning")}</p>
      </div>
    </ui.Dialog>
  )
}
