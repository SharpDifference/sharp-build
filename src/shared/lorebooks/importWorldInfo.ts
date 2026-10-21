import {
  LOREBOOK_SCHEMA_VERSION,
  MAX_LORE_ENTRIES,
  MAX_LORE_KEY_LENGTH,
  MAX_LORE_KEYS,
  MAX_LORE_NAME_LENGTH,
  MAX_LORE_TEXT_LENGTH,
  isSafeLoreId,
  validateLoreBook
} from './rules'
import type { LoreBook, LoreBookEntry } from './types'

/**
 * Reads a SillyTavern World Info file into a lorebook. An entry this game cannot match the way
 * the file means is kept but turned off, with the reason on it; nothing here writes anything.
 */

/** An entry the import turned off or left out, and why. */
export interface WorldInfoNote {
  name: string
  reason: string
}

/** What an import found, for the player to read before the book is kept. */
export interface WorldInfoReport {
  /** Entries in the file. */
  found: number
  /** Entries in the book. */
  kept: number
  /** Entries that work as soon as the book is on. */
  working: number
  /** Entries kept but turned off: the file's own, or ones this game cannot match as written. */
  off: WorldInfoNote[]
  /** Entries left out of the book. */
  dropped: WorldInfoNote[]
  /** Macros the text carries, which are sent as written, and how many entries carry each. */
  macros: { macro: string; entries: number }[]
  /** Anything else changed to fit, such as keys cut to the limit. */
  notes: string[]
}

export type WorldInfoResult =
  | { ok: true; book: LoreBook; report: WorldInfoReport }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The file's entries in the order it lists them, whether it keeps them as an array or an object keyed by number. */
function rawEntries(json: Record<string, unknown>): Record<string, unknown>[] | null {
  const entries = json.entries
  if (Array.isArray(entries)) return entries.filter(isRecord)
  if (!isRecord(entries)) return null
  return Object.keys(entries)
    .sort((a, b) => {
      const x = Number(a)
      const y = Number(b)
      return Number.isFinite(x) && Number.isFinite(y) ? x - y : 0
    })
    .map((key) => entries[key])
    .filter(isRecord)
}

/** A list of keys as the file writes it: an array, or one comma-separated string. */
function keyList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return items.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

/** True for a key written as a regular expression, `/…/flags`. */
function isRegexKey(key: string): boolean {
  return /^\/.+\/[a-z]*$/.test(key)
}

/** The first of `names` the entry has. */
function field(entry: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (entry[name] !== undefined) return entry[name]
  return undefined
}

/** Every distinct macro in `text`, lowercased. */
function macrosIn(text: string): string[] {
  return [...new Set((text.match(/\{\{[^{}]+\}\}/g) ?? []).map((macro) => macro.toLowerCase()))]
}

/** A uid the book accepts, unique among `used`: the file's own where it is safe, else the entry's place in the file. */
function uidFor(raw: unknown, position: number, used: Set<string>): string {
  const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
  const cleaned = text.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 56)
  let uid = isSafeLoreId(cleaned) ? cleaned : `e${position + 1}`
  for (let n = 2; used.has(uid); n++) uid = `${uid.slice(0, 56)}-${n}`
  used.add(uid)
  return uid
}

/** The book's name: the file's own, else the file's name without its extension. */
function bookNameOf(json: Record<string, unknown>, fileName: string): string {
  const own = typeof json.name === 'string' ? json.name.trim() : ''
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').trim()
  return (own || base || 'World Info').slice(0, MAX_LORE_NAME_LENGTH)
}

/**
 * The lorebook a World Info file holds, with a report of what came in. `id` is the new book's
 * id; `fileName` names it when the file does not.
 */
export function importWorldInfo(json: unknown, id: string, fileName: string): WorldInfoResult {
  if (!isRecord(json)) return { ok: false, error: 'That file is not a World Info file.' }
  const raw = rawEntries(json)
  if (!raw) return { ok: false, error: 'That file has no entries. It may not be a World Info file.' }
  if (raw.length === 0) return { ok: false, error: 'That World Info file has no entries.' }

  const entries: LoreBookEntry[] = []
  const off: WorldInfoNote[] = []
  const dropped: WorldInfoNote[] = []
  const notes: string[] = []
  const macroCounts = new Map<string, number>()
  const used = new Set<string>()
  let working = 0

  raw.forEach((source, position) => {
    const comment = field(source, 'comment', 'name')
    const name = typeof comment === 'string' ? comment.trim().slice(0, MAX_LORE_NAME_LENGTH) : ''
    let keys = keyList(field(source, 'key', 'keys'))
    const label = name || keys[0] || `Entry ${position + 1}`
    const contentValue = field(source, 'content')
    const text = typeof contentValue === 'string' ? contentValue.trim() : ''

    if (entries.length >= MAX_LORE_ENTRIES) {
      dropped.push({ name: label, reason: `The book holds ${MAX_LORE_ENTRIES} entries at most.` })
      return
    }
    if (text === '') {
      dropped.push({ name: label, reason: 'It has no text.' })
      return
    }
    if (text.length > MAX_LORE_TEXT_LENGTH) {
      dropped.push({ name: label, reason: `Its text is longer than ${MAX_LORE_TEXT_LENGTH} characters.` })
      return
    }

    const longKeys = keys.filter((key) => key.length > MAX_LORE_KEY_LENGTH)
    if (longKeys.length > 0) {
      keys = keys.filter((key) => key.length <= MAX_LORE_KEY_LENGTH)
      notes.push(`${label}: left out ${longKeys.length === 1 ? 'a key' : `${longKeys.length} keys`} longer than ${MAX_LORE_KEY_LENGTH} characters.`)
    }
    keys = [...new Set(keys)]
    if (keys.length > MAX_LORE_KEYS) {
      notes.push(`${label}: kept its first ${MAX_LORE_KEYS} of ${keys.length} keys.`)
      keys = keys.slice(0, MAX_LORE_KEYS)
    }

    const always = field(source, 'constant') === true
    const secondary = keyList(field(source, 'keysecondary', 'secondary_keys'))
    const fileOff = field(source, 'disable') === true || field(source, 'enabled') === false

    const reasons: string[] = []
    if (secondary.length > 0 && field(source, 'selective') !== false) {
      reasons.push('It also needs a secondary key, and this game reads only the main keys.')
    }
    if (keys.some(isRegexKey)) {
      reasons.push('A key is a regular expression, and this game matches words.')
    }
    if (keys.length === 0 && !always) {
      // The book refuses an entry that nothing can trigger, so its name stands in as a key.
      keys = [label.slice(0, MAX_LORE_KEY_LENGTH)]
      reasons.push('It has no trigger keys. Its name stands in as a key; give it real ones before turning it on.')
    }

    const conflict = reasons.join(' ')
    const entry: LoreBookEntry = {
      uid: uidFor(field(source, 'uid'), position, used),
      keys,
      text,
      enabled: !fileOff && conflict === ''
    }
    if (name) entry.name = name
    if (always) entry.always = true
    if (conflict) entry.conflict = conflict
    entries.push(entry)

    if (fileOff && conflict === '') off.push({ name: label, reason: 'Turned off in the file.' })
    else if (conflict !== '') off.push({ name: label, reason: conflict })
    else working++

    for (const macro of macrosIn(text)) macroCounts.set(macro, (macroCounts.get(macro) ?? 0) + 1)
  })

  const book: LoreBook = {
    schemaVersion: LOREBOOK_SCHEMA_VERSION,
    id,
    name: bookNameOf(json, fileName),
    source: 'sillytavern',
    entries
  }
  const checked = validateLoreBook(book)
  if (!checked.ok) return { ok: false, error: checked.error }
  if (checked.book.entries.length === 0) {
    return { ok: false, error: 'Nothing in that file could be brought in.' }
  }

  return {
    ok: true,
    book: checked.book,
    report: {
      found: raw.length,
      kept: entries.length,
      working,
      off,
      dropped,
      macros: [...macroCounts].map(([macro, count]) => ({ macro, entries: count })).sort((a, b) => b.entries - a.entries || a.macro.localeCompare(b.macro)),
      notes
    }
  }
}
