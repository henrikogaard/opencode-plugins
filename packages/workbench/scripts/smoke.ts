import { createGithub } from "../src/server/github"

const directory = process.argv[2] ?? process.cwd()
const github = createGithub()
const snapshot = await github.snapshot({ directory, includeAll: true, refresh: true }, new AbortController().signal)

console.log(
  JSON.stringify(
    {
      ...snapshot,
      prs: snapshot.prs.map((pull) => ({
        number: pull.number,
        title: pull.title,
        branch: pull.branch,
        checks: pull.checks,
        review: pull.review,
        mergeable: pull.mergeable,
      })),
    },
    null,
    2,
  ),
)
