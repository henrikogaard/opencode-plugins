import { Plugin } from "@opencode/plugin"
import {
  Workbench,
  type CreatePullInput,
  type MergePullInput,
  type ReadImageInput,
  type SnapshotInput,
} from "./rpc"
import { createGithub } from "./server/github"
import { readImage } from "./server/image"

export default Plugin.define({
  id: "workbench",
  async setup(ctx) {
    const github = createGithub()
    let emit: (directory: string) => Promise<void> = async () => {}

    const registration = await ctx.rpc.register(Workbench, {
      snapshot: async (input, call) => github.snapshot(input as SnapshotInput, call.signal),
      createPull: async (input, call) => {
        const value = input as CreatePullInput
        const result = await github.createPull(value, call.signal)
        if (result.ok || result.pushed) await emit(value.directory).catch(() => {})
        return result
      },
      mergePull: async (input, call) => {
        const value = input as MergePullInput
        const result = await github.mergePull(value, call.signal)
        if (result.ok || result.pushed) await emit(value.directory).catch(() => {})
        return result
      },
      readImage: async (input) => readImage((input as ReadImageInput).path),
    })

    emit = (directory) => registration.events.emit("refreshed", { directory })

    return () => void registration.dispose()
  },
})
