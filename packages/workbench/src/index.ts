import { Plugin } from "@opencode/plugin"
import { Workbench, type CreatePullInput, type MergePullInput, type SnapshotInput } from "./rpc"
import { createGithub } from "./server/github"

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
        if (result.ok) await emit(value.directory)
        return result
      },
      mergePull: async (input, call) => {
        const value = input as MergePullInput
        const result = await github.mergePull(value, call.signal)
        if (result.ok) await emit(value.directory)
        return result
      },
    })

    emit = (directory) => registration.events.emit("refreshed", { directory })

    return () => void registration.dispose()
  },
})
