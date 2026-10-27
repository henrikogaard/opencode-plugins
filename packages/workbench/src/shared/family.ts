export interface FamilyData {
  session: {
    family(sessionID: string): readonly string[]
    sync(sessionID: string, options?: { children?: boolean }): Promise<void>
  }
}

export interface SyncFamilyOptions {
  /** Maximum rounds of discovery. Default 12. */
  maxDepth?: number
  /** Maximum members to synchronize. Default 200. */
  maxMembers?: number
}

/**
 * Loads a session's whole descendant tree, not just its direct children.
 *
 * `sync(..., { children: true })` discovers one level. Each newly discovered
 * member is synchronized in turn until no new members appear.
 */
export async function syncFamily(data: FamilyData, rootID: string, options?: SyncFamilyOptions): Promise<void> {
  if (!rootID) return

  const maxDepth = options?.maxDepth ?? 12
  const maxMembers = options?.maxMembers ?? 200
  const seen = new Set<string>()

  for (let depth = 0; depth < maxDepth; depth++) {
    const pending = data.session.family(rootID).filter((id) => !seen.has(id))
    if (pending.length === 0) return

    for (const id of pending) {
      if (seen.size >= maxMembers) return
      seen.add(id)

      try {
        await data.session.sync(id, { children: true })
      } catch {
        // Keep the partial tree: a failed member does not hide its siblings.
      }
    }
  }
}
