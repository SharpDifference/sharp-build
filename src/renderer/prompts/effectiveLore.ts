import type { LoreBook, LoreIndex, ShippedLoreOverride } from '@shared/lorebooks/types'
import {
  entryPattern,
  LOREBOOK,
  shippedRefOf,
  type EffectiveLore,
  type LoreEntry,
  type PlayerLoreItem,
  type ShippedLoreItem
} from './lorebook'

/**
 * The lorebook the prompts read once the player's edits are applied: the shipped entries with
 * their text, keys and on/off as edited, and the entries of the books that are on.
 */

/** The keys of a shipped entry as edited: an entry with an id only ever gains keys, one without only has them replaced. */
function keysOf(entry: LoreEntry, override: ShippedLoreOverride | undefined): readonly string[] {
  if (entry.id) {
    const added = (override?.addedKeys ?? []).filter(
      (key) => !entry.keys.some((own) => own.toLowerCase() === key.toLowerCase())
    )
    return added.length > 0 ? [...entry.keys, ...added] : entry.keys
  }
  return override?.keys && override.keys.length > 0 ? override.keys : entry.keys
}

/** One shipped entry as edited; the shipped object itself where nothing about it was changed. */
function shippedItem(entry: LoreEntry, override: ShippedLoreOverride | undefined): ShippedLoreItem {
  const ref = shippedRefOf(entry)
  const keys = keysOf(entry, override)
  const text = override?.text !== undefined && override.text.trim() !== '' ? override.text : entry.text
  const enabled = override?.enabled !== false
  if (keys === entry.keys && text === entry.text) {
    return { ref, entry, shipped: entry, pattern: entryPattern(entry), enabled }
  }
  const edited: LoreEntry = { ...(entry.id ? { id: entry.id } : {}), keys, text, ref }
  return { ref, entry: edited, shipped: entry, pattern: entryPattern(edited), enabled }
}

/**
 * The lorebook as the player has it. `on` names the books in force, in the order they apply:
 * the index holds the global list, and a save's own could be passed in its place.
 */
export function effectiveLore(
  index: Pick<LoreIndex, 'shipped'> | undefined,
  books: Readonly<Record<string, LoreBook>>,
  on: readonly string[]
): EffectiveLore {
  const player: PlayerLoreItem[] = []
  const playerTexts: string[] = []
  const always: string[] = []
  for (const id of on) {
    const book = books[id]
    if (!book) continue
    for (const entry of book.entries) {
      if (!entry.enabled || entry.text.trim() === '') continue
      if (entry.always) {
        always.push(entry.text)
        playerTexts.push(entry.text)
        continue
      }
      if (entry.keys.length === 0) continue
      const keyed: LoreEntry = { keys: entry.keys, text: entry.text }
      try {
        player.push({ entry: keyed, pattern: entryPattern(keyed) })
        playerTexts.push(entry.text)
      } catch {
        // A key the matcher cannot compile leaves that one entry out rather than every prompt.
      }
    }
  }
  return {
    shipped: LOREBOOK.map((entry) => shippedItem(entry, index?.shipped?.[shippedRefOf(entry)])),
    player,
    playerTexts,
    always
  }
}
