import { appError } from '@shared/errors'
import {
  LOREBOOK_INVALID,
  readLorebookRecord,
  type LorebookRecord
} from '@shared/lorebookRecord'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { database, storage } from './open'

/**
 * A playthrough's lorebook in the browser's storage: one row under the playthrough's id, never
 * written where the playthrough's own row is gone.
 */

/** The lorebook kept for one playthrough, or `null` where it keeps none. */
export async function readLorebook(playthroughId: string): Promise<LorebookRecord | null> {
  assertSafePlaythroughId(playthroughId)
  const row = await storage('read the lorebook', async () =>
    (await database()).get('lorebooks', playthroughId)
  )
  return row === undefined ? null : readLorebookRecord(row, `lorebooks/${playthroughId}`)
}

/**
 * Keeps a playthrough's lorebook whole, in one transaction over both stores; a playthrough
 * already gone leaves nothing written.
 */
export async function writeLorebook(playthroughId: string, lorebook: unknown): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  // Checked before the transaction opens, which an await outside the database would close.
  const record = readLorebookRecord(lorebook, 'lorebook', LOREBOOK_INVALID)

  const wrote = await storage('save the lorebook', async () => {
    const db = await database()
    const tx = db.transaction(['playthroughs', 'lorebooks'], 'readwrite')
    // Both are database requests, so the transaction is still open for the second.
    const exists = await tx.objectStore('playthroughs').get(playthroughId)
    if (exists) void tx.objectStore('lorebooks').put(record, playthroughId)
    await tx.done
    return Boolean(exists)
  })

  if (!wrote) throw appError('LOREBOOK_PLAYTHROUGH_GONE', 'That playthrough no longer exists.')
}
