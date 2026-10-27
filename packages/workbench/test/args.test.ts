import { describe, expect, test } from "bun:test"
import { createPullArgs, pushArgs } from "../src/server/args"

describe("pushArgs", () => {
  test("puts an option terminator before the full ref", () => {
    expect(pushArgs("feature/workbench")).toEqual([
      "push",
      "-u",
      "origin",
      "--",
      "refs/heads/feature/workbench",
    ])
  })

  test("does not let an option-like branch become a git option", () => {
    expect(pushArgs("--force")).toEqual(["push", "-u", "origin", "--", "refs/heads/--force"])
    expect(pushArgs("--mirror")).toEqual(["push", "-u", "origin", "--", "refs/heads/--mirror"])
  })
})

describe("createPullArgs", () => {
  test("passes the branch and base as option values", () => {
    expect(
      createPullArgs({
        branch: "feature/workbench",
        base: "main",
        title: "Add workbench",
        body: "Body",
        draft: true,
      }),
    ).toEqual([
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "feature/workbench",
      "--title",
      "Add workbench",
      "--body",
      "Body",
      "--draft",
    ])
  })
})
