import { describe, expect, test } from "bun:test"
import { run } from "../src/server/exec"

const sleep = ["-e", "setTimeout(() => {}, 1_000)"]

describe("run", () => {
  test("marks a timeout without calling it an abort", async () => {
    const result = await run(process.execPath, sleep, { timeout: 50 })
    expect(result.timedOut).toBe(true)
    expect(result.aborted).toBe(false)
  })

  test("marks an abort without calling it a timeout", async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)

    const result = await run(process.execPath, sleep, { signal: controller.signal })
    expect(result.aborted).toBe(true)
    expect(result.timedOut).toBe(false)
  })
})
