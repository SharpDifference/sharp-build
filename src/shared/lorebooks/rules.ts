import { appError } from '../errors'
import { assertSafeId } from '../jsonValidate'
import type {
  LoreBook,
  LoreBookEntry,
  LoreBookListing,
  LoreBookSummary,
  LoreIndex,
  ShippedLoreOverride,
  ShippedLoreOverrides
} from './types'

/**
 * The rules every store of lorebooks keeps, whether it is a folder of files or rows of the
 * browser's database: what a book and the index hold, and how both are normalized.
 */

/** The one version of a lorebook file and of the lorebooks index this build reads and writes. */
export const LOREBOOK_SCHEMA_VERSION = 1

/** The largest import file read; a longer one is refused unread. */
export const MAX_LOREBOOK_BYTES = 8 * 1024 * 1024

export const MAX_LORE_ENTRIES = 5000
export const MAX_LORE_KEYS = 64
export const MAX_LORE_KEY_LENGTH = 200
export const MAX_LORE_TEXT_LENGTH = 20000
export const MAX_LORE_NAME_LENGTH = 200
/** The longest shipped reference an override may be kept under. */
export const MAX_LORE_REF_LENGTH = 200

/** A book id is its file name, and an entry uid is used as a key, so both are limited to what cannot leave the folder. */
const SAFE_LORE_ID = /^[A-Za-z0-9_-]{1,64}$/

/** True for an id that is safe to use as a file name. */
export function isSafeLoreId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_LORE_ID.test(id)
}

/** Rejects a book id that could escape the lorebooks folder. */
export function assertSafeLoreBookId(id: string): void {
  assertSafeId(id, SAFE_LORE_ID, 'LOREBOOK_ID_INVALID', 'That lorebook id is not valid.')
}

/** Rejects an import file longer than the cap, given its size. */
export function assertLoreFileSize(size: number): void {
  if (size > MAX_LOREBOOK_BYTES) throw appError('LOREBOOK_TOO_LARGE', 'That lorebook file is too large.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The keys trimmed, blanks and repeats dropped; null where any is too long, not text, or there are too many. */
function cleanedKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const keys: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const key = item.trim()
    if (key === '' || keys.includes(key)) continue
    if (key.length > MAX_LORE_KEY_LENGTH) return null
    keys.push(key)
  }
  return keys.length > MAX_LORE_KEYS ? null : keys
}

/** One entry as it is kept, or the reason it is refused. */
function validateEntry(
  value: unknown,
  position: number
): { ok: true; entry: LoreBookEntry } | { ok: false; error: string } {
  const at = `Entry ${position + 1}`
  if (!isRecord(value)) return { ok: false, error: `${at} is not an object.` }
  if (!isSafeLoreId(value.uid)) return { ok: false, error: `${at} has no valid uid.` }
  if (typeof value.text !== 'string') return { ok: false, error: `${at} has no text.` }
  if (value.text.length > MAX_LORE_TEXT_LENGTH) return { ok: false, error: `${at} has too much text.` }
  if (typeof value.enabled !== 'boolean') return { ok: false, error: `${at} does not say whether it is enabled.` }
  const keys = cleanedKeys(value.keys)
  if (!keys) return { ok: false, error: `${at} has keys that are not valid.` }
  const always = value.always === true
  if (keys.length === 0 && !always) return { ok: false, error: `${at} has no keys and is not always on.` }
  const entry: LoreBookEntry = { uid: value.uid, keys, text: value.text, enabled: value.enabled }
  if (value.name !== undefined) {
    if (typeof value.name !== 'string' || value.name.length > MAX_LORE_NAME_LENGTH) {
      return { ok: false, error: `${at} has a name that is not valid.` }
    }
    if (value.name.trim() !== '') entry.name = value.name.trim()
  }
  if (always) entry.always = true
  if (value.conflict !== undefined) {
    if (typeof value.conflict !== 'string' || value.conflict.length > MAX_LORE_NAME_LENGTH) {
      return { ok: false, error: `${at} has a conflict that is not valid.` }
    }
    if (value.conflict !== '') entry.conflict = value.conflict
  }
  return { ok: true, entry }
}

/** Checks a parsed lorebook and returns it as it is kept: keys trimmed, blanks and absent flags left out. */
export function validateLoreBook(json: unknown): { ok: true; book: LoreBook } | { ok: false; error: string } {
  if (!isRecord(json)) return { ok: false, error: 'The lorebook is not an object.' }
  if (json.schemaVersion !== LOREBOOK_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `The lorebook has unsupported schemaVersion ${String(json.schemaVersion)}; this build expects ${LOREBOOK_SCHEMA_VERSION}.`
    }
  }
  if (!isSafeLoreId(json.id)) return { ok: false, error: 'The lorebook has no valid id.' }
  if (typeof json.name !== 'string' || json.name.trim() === '' || json.name.length > MAX_LORE_NAME_LENGTH) {
    return { ok: false, error: 'The lorebook has no valid name.' }
  }
  if (json.source !== 'native' && json.source !== 'sillytavern') {
    return { ok: false, error: 'The lorebook has an unknown source.' }
  }
  if (!Array.isArray(json.entries)) return { ok: false, error: 'The lorebook has no entries.' }
  if (json.entries.length > MAX_LORE_ENTRIES) return { ok: false, error: 'The lorebook has too many entries.' }
  const entries: LoreBookEntry[] = []
  const uids = new Set<string>()
  for (let i = 0; i < json.entries.length; i++) {
    const checked = validateEntry(json.entries[i], i)
    if (!checked.ok) return checked
    if (uids.has(checked.entry.uid)) return { ok: false, error: `Entry ${i + 1} repeats a uid.` }
    uids.add(checked.entry.uid)
    entries.push(checked.entry)
  }
  return {
    ok: true,
    book: { schemaVersion: LOREBOOK_SCHEMA_VERSION, id: json.id, name: json.name.trim(), source: json.source, entries }
  }
}

/** The lorebook checked for keeping; refuses an unsafe id or a malformed book. */
export function loreBookToKeep(book: Omit<LoreBook, 'schemaVersion'>): LoreBook {
  if (!isSafeLoreId(book?.id)) throw appError('LOREBOOK_ID_INVALID', 'That lorebook id is not valid.', String(book?.id))
  const checked = validateLoreBook({ ...book, schemaVersion: LOREBOOK_SCHEMA_VERSION })
  if (!checked.ok) throw appError('LOREBOOK_INVALID', 'That lorebook could not be saved.', checked.error)
  return checked.book
}

/** Reads a stored lorebook, or null where it is malformed or its id is not the one it is kept under. */
export function readStoredLoreBook(json: unknown, expectedId?: string): LoreBook | null {
  const checked = validateLoreBook(json)
  if (!checked.ok) return null
  if (expectedId !== undefined && checked.book.id !== expectedId) return null
  return checked.book
}

/** One override as it is kept, or null where nothing is left of it. */
function overrideToKeep(value: unknown): ShippedLoreOverride | null {
  if (!isRecord(value)) return null
  const kept: ShippedLoreOverride = {}
  if (typeof value.text === 'string' && value.text.trim() !== '' && value.text.length <= MAX_LORE_TEXT_LENGTH) {
    kept.text = value.text
  }
  for (const field of ['addedKeys', 'keys'] as const) {
    const keys = cleanedKeys(value[field])
    if (keys && keys.length > 0) kept[field] = keys
  }
  if (value.enabled === false) kept.enabled = false
  return Object.keys(kept).length > 0 ? kept : null
}

/** The overrides as they are kept: untouched ones dropped, keys trimmed, blank text and `enabled: true` left out; undefined where none remain. */
export function shippedToKeep(value: unknown): ShippedLoreOverrides | undefined {
  if (!isRecord(value)) return undefined
  const kept: ShippedLoreOverrides = {}
  for (const [ref, override] of Object.entries(value)) {
    if (ref === '' || ref.length > MAX_LORE_REF_LENGTH) continue
    const next = overrideToKeep(override)
    if (next) kept[ref] = next
  }
  return Object.keys(kept).length > 0 ? kept : undefined
}

/** The index as it is kept, `on` holding only ids of `existing` books, once each. */
export function loreIndexToKeep(
  index: { shipped?: unknown; on?: unknown } | null | undefined,
  existing: ReadonlySet<string>
): LoreIndex {
  const on: string[] = []
  if (Array.isArray(index?.on)) {
    for (const id of index.on) {
      if (typeof id === 'string' && existing.has(id) && !on.includes(id)) on.push(id)
    }
  }
  const shipped = shippedToKeep(index?.shipped)
  return { schemaVersion: LOREBOOK_SCHEMA_VERSION, ...(shipped ? { shipped } : {}), on }
}

/** Checks a parsed index: an object of this build's version, repaired against the books that exist. Refusals carry `where`. */
export function readLoreIndex(parsed: unknown, existing: ReadonlySet<string>, where: string): LoreIndex {
  if (!isRecord(parsed)) {
    throw appError('LOREBOOK_INDEX_MALFORMED', 'The lorebooks index is damaged.', where)
  }
  if (parsed.schemaVersion !== LOREBOOK_SCHEMA_VERSION) {
    throw appError(
      'LOREBOOK_INDEX_SCHEMA_VERSION',
      'The lorebooks index was written by another version of the game.',
      `${where}: schemaVersion ${String(parsed.schemaVersion)}; this build expects ${LOREBOOK_SCHEMA_VERSION}.`
    )
  }
  return loreIndexToKeep(parsed, existing)
}

/** An index with nothing in it. */
export function emptyLoreIndex(): LoreIndex {
  return { schemaVersion: LOREBOOK_SCHEMA_VERSION, on: [] }
}

/** True where two indexes would be written the same. */
export function sameLoreIndex(a: LoreIndex, b: LoreIndex): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** A book as the list shows it. */
export function loreSummaryOf(book: LoreBook): LoreBookSummary {
  return { id: book.id, name: book.name, source: book.source, entryCount: book.entries.length }
}

/** The list channel's answer: the index and every book's summary, by name. */
export function loreListingOf(index: LoreIndex, books: readonly LoreBook[]): LoreBookListing {
  return { index, books: books.map(loreSummaryOf).sort((a, b) => a.name.localeCompare(b.name)) }
}
