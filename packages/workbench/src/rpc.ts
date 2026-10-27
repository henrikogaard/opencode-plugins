import { Rpc } from "@opencode/plugin/rpc"

export type CheckState = "success" | "failure" | "pending" | "none"
export type ReviewState = "approved" | "changes" | "required" | "none"
export type MergeableState = "mergeable" | "conflicting" | "unknown"

export interface PullRequest {
  number: number
  title: string
  url: string
  state: string
  draft: boolean
  branch: string
  base: string
  author?: string
  review: ReviewState
  mergeable: MergeableState
  checks: CheckState
  updatedAt?: string
}

export interface Issue {
  number: number
  title: string
  url: string
  updatedAt?: string
}

export interface Snapshot {
  directory: string
  repo?: string
  url?: string
  branch: string
  base?: string
  ahead: number
  behind: number
  dirty: number
  additions: number
  deletions: number
  auth: boolean
  prs: PullRequest[]
  current?: PullRequest
  issues: Issue[]
  at: number
  error?: string
  issuesError?: string
}

export interface SnapshotInput {
  directory: string
  branch?: string
  includeAll?: boolean
  includeIssues?: boolean
  ghPath?: string
  refresh?: boolean
}

export interface CreatePullInput {
  directory: string
  title: string
  body: string
  base?: string
  draft?: boolean
  push?: boolean
  ghPath?: string
}

export interface MergePullInput {
  directory: string
  number: number
  method: "merge" | "squash" | "rebase"
  deleteBranch?: boolean
  ghPath?: string
}

export interface MutationOutput {
  ok: boolean
  url?: string
  error?: string
}

const PullRequestSchema = {
  type: "object",
  properties: {
    number: { type: "number" },
    title: { type: "string" },
    url: { type: "string" },
    state: { type: "string" },
    draft: { type: "boolean" },
    branch: { type: "string" },
    base: { type: "string" },
    author: { type: "string" },
    review: { enum: ["approved", "changes", "required", "none"] },
    mergeable: { enum: ["mergeable", "conflicting", "unknown"] },
    checks: { enum: ["success", "failure", "pending", "none"] },
    updatedAt: { type: "string" },
  },
  required: ["number", "title", "url", "state", "draft", "branch", "base", "review", "mergeable", "checks"],
  additionalProperties: false,
} as const

const IssueSchema = {
  type: "object",
  properties: {
    number: { type: "number" },
    title: { type: "string" },
    url: { type: "string" },
    updatedAt: { type: "string" },
  },
  required: ["number", "title", "url"],
  additionalProperties: false,
} as const

const SnapshotSchema = {
  type: "object",
  properties: {
    directory: { type: "string" },
    repo: { type: "string" },
    url: { type: "string" },
    branch: { type: "string" },
    base: { type: "string" },
    ahead: { type: "number" },
    behind: { type: "number" },
    dirty: { type: "number" },
    additions: { type: "number" },
    deletions: { type: "number" },
    auth: { type: "boolean" },
    prs: { type: "array", items: PullRequestSchema },
    current: PullRequestSchema,
    issues: { type: "array", items: IssueSchema },
    at: { type: "number" },
    error: { type: "string" },
    issuesError: { type: "string" },
  },
  required: [
    "directory",
    "branch",
    "ahead",
    "behind",
    "dirty",
    "additions",
    "deletions",
    "auth",
    "prs",
    "issues",
    "at",
  ],
  additionalProperties: false,
} as const

const SnapshotInputSchema = {
  type: "object",
  properties: {
    directory: { type: "string" },
    branch: { type: "string" },
    includeAll: { type: "boolean" },
    includeIssues: { type: "boolean" },
    ghPath: { type: "string" },
    refresh: { type: "boolean" },
  },
  required: ["directory"],
  additionalProperties: false,
} as const

const CreatePullInputSchema = {
  type: "object",
  properties: {
    directory: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    base: { type: "string" },
    draft: { type: "boolean" },
    push: { type: "boolean" },
    ghPath: { type: "string" },
  },
  required: ["directory", "title", "body"],
  additionalProperties: false,
} as const

const MergePullInputSchema = {
  type: "object",
  properties: {
    directory: { type: "string" },
    number: { type: "number" },
    method: { enum: ["merge", "squash", "rebase"] },
    deleteBranch: { type: "boolean" },
    ghPath: { type: "string" },
  },
  required: ["directory", "number", "method"],
  additionalProperties: false,
} as const

const MutationOutputSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    url: { type: "string" },
    error: { type: "string" },
  },
  required: ["ok"],
  additionalProperties: false,
} as const

export const Workbench = Rpc.define({
  id: "workbench",
  methods: {
    snapshot: {
      input: SnapshotInputSchema,
      output: SnapshotSchema,
    },
    createPull: {
      input: CreatePullInputSchema,
      output: MutationOutputSchema,
    },
    mergePull: {
      input: MergePullInputSchema,
      output: MutationOutputSchema,
    },
  },
  events: {
    refreshed: {
      schema: {
        type: "object",
        properties: { directory: { type: "string" } },
        required: ["directory"],
        additionalProperties: false,
      },
    },
  },
})
