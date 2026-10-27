import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access } from "node:fs/promises"

export interface RunOptions {
  cwd?: string
  signal?: AbortSignal
  timeout?: number
  env?: NodeJS.ProcessEnv
}

export interface RunResult {
  code: number
  stdout: string
  stderr: string
  aborted: boolean
  reason?: string
}

export function run(command: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      [...args],
      {
        cwd: options.cwd,
        signal: options.signal,
        timeout: options.timeout ?? 30_000,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
        env: {
          ...process.env,
          ...options.env,
          GH_PROMPT_DISABLED: "1",
          GH_NO_UPDATE_NOTIFIER: "1",
          GIT_TERMINAL_PROMPT: "0",
          NO_COLOR: "1",
          CLICOLOR: "0",
        },
      },
      (error, stdout, stderr) => {
        const failure = error as { code?: number | string; name?: string } | null
        const reason = typeof failure?.code === "string" ? failure.code : undefined

        resolve({
          code:
            typeof failure?.code === "number"
              ? failure.code
              : reason === "ENOENT"
                ? 127
                : error
                  ? 1
                  : 0,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          aborted: failure?.name === "AbortError" || options.signal?.aborted === true,
          reason,
        })
      },
    )
  })
}

export async function findGh(preferred?: string): Promise<string> {
  const explicit = preferred?.trim() || process.env.WORKBENCH_GH?.trim()
  if (explicit) return explicit

  const candidates = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"]

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next well-known location.
    }
  }

  return "gh"
}

export function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "")
}

export function cleanError(stderr: string, stdout: string): string {
  const value = stripAnsi(stderr).trim() || stripAnsi(stdout).trim()
  if (!value) return "The command failed without output."

  return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value
}

export function firstUrl(value: string): string | undefined {
  const match = value.match(/https?:\/\/[^\s]+/)
  return match?.[0].replace(/[),.]+$/, "")
}
