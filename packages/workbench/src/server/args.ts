export function pushArgs(branch: string): string[] {
  return ["push", "-u", "origin", "--", `refs/heads/${branch}`]
}

export function createPullArgs(input: {
  branch: string
  base: string
  title: string
  body: string
  draft?: boolean
}): string[] {
  const args = [
    "pr",
    "create",
    "--base",
    input.base,
    "--head",
    input.branch,
    "--title",
    input.title,
    "--body",
    input.body,
  ]

  if (input.draft === true) args.push("--draft")
  return args
}
