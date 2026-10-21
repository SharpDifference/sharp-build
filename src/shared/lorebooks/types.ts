/** One lorebook entry: text sent when a key shows up in the recent scene, or always. */
export interface LoreBookEntry {
  /** Unique within its book. */
  uid: string
  name?: string
  keys: string[]
  text: string
  enabled: boolean
  /** Sent on every call, with no key needed. Absent is false. */
  always?: boolean
  /** Why the import turned this entry off. */
  conflict?: string
}

/** Where a lorebook came from. */
export type LoreBookSource = 'native' | 'sillytavern'

/** A lorebook as it is stored. */
export interface LoreBook {
  schemaVersion: number
  id: string
  name: string
  source: LoreBookSource
  entries: LoreBookEntry[]
}

/** What the player changed on one shipped entry; every field is absent where it is untouched. */
export interface ShippedLoreOverride {
  /** Replaces the shipped text. */
  text?: string
  /** Keys added to an entry that has an id of its own. */
  addedKeys?: string[]
  /** Keys that replace those of an entry that has no id of its own. */
  keys?: string[]
  /** Only ever false: absent is enabled. */
  enabled?: boolean
}

/** Overrides by shipped reference. */
export type ShippedLoreOverrides = Record<string, ShippedLoreOverride>

/** `data/prompt-studio/lorebooks/index.json`: the shipped entries as edited, and which books are on. */
export interface LoreIndex {
  schemaVersion: number
  shipped?: ShippedLoreOverrides
  /** Ids of books that exist, in the order they are applied. */
  on: string[]
}

/** A lorebook as the list shows it. */
export interface LoreBookSummary {
  id: string
  name: string
  source: LoreBookSource
  entryCount: number
}

/** The lorebooks channel's answer to a list. */
export interface LoreBookListing {
  index: LoreIndex
  books: LoreBookSummary[]
}

/** A file the player picked to import, unread by anything but its size: the caller parses it. */
export interface LoreBookFile {
  text: string
  fileName: string
}
