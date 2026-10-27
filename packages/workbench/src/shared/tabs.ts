export interface TabRow {
  key: string
  index: number
  group: string
  updated: number
  draft: boolean
}

export type TabSort = "project" | "recent"

export function orderTabs(rows: readonly TabRow[], sort: TabSort = "project"): TabRow[] {
  return [...rows].sort((a, b) => {
    if (a.draft !== b.draft) return a.draft ? 1 : -1

    if (sort === "recent" && a.updated !== b.updated) return b.updated - a.updated

    if (sort === "project" && a.group !== b.group) return a.group.localeCompare(b.group)

    return a.index - b.index
  })
}
