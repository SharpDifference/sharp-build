import { isSafeBgName } from './customBackgrounds'
import { appError } from './errors'
import { validateRecord, type ValidateRecordOptions } from './jsonValidate'
import { sha256Hex } from './sha256'

/**
 * A playthrough's own lorebook: what the player changed of the shipped entries, field by field,
 * and the entries they wrote themselves; and the SillyTavern World Info file it travels as. An
 * entry or a field the player never changed is not kept, so it always reads as the build ships it.
 */

const LOREBOOK_SCHEMA_VERSION = 1

/** The file kept beside a playthrough's record. */
export const LOREBOOK_FILE_NAME = 'lorebook.json'

/** What an exported lorebook is offered under; SillyTavern names the world after it. */
export const WORLD_INFO_EXPORT_NAME = 'Venus University Lorebook.json'

/** A shipped entry's handle: lowercase words joined by single underscores. */
const LORE_REF = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

/** A player's own entry's id: `custom<n>`, n a whole number from one. */
const CUSTOM_LORE_ID = /^custom[1-9][0-9]*$/

/** What the player changed of one shipped entry; a field left as shipped is absent. */
export interface LoreEdit {
  keys?: string[]
  text?: string
}

/** One entry the player wrote, with the background the writer is pointed at for it. */
interface CustomLoreEntry {
  id: string
  keys: string[]
  text: string
  bg?: string
}

/** A playthrough's lorebook as it is kept. */
export interface LorebookRecord {
  schemaVersion: number
  /** By shipped entry handle. */
  edits: Record<string, LoreEdit>
  /** In the order they were made. */
  custom: CustomLoreEntry[]
}

/** What the record's rules read of one shipped entry. */
export interface ShippedLore {
  ref: string
  keys: readonly string[]
  text: string
}

/** What an imported file's entry is worth keeping as. */
interface ImportedLore {
  keys: string[]
  text: string
  /** The shipped entry it was exported as, where the file says so. */
  ref?: string
  /** The shipped words it was exported against, where the file says so. */
  fingerprint?: { keys: string; text: string }
  bg?: string
}

/** A World Info file read: the entries worth keeping, and how many were not. */
export interface WorldInfoImport {
  entries: ImportedLore[]
  leftOut: number
}

/** What this game writes into an entry of a World Info file, and reads back out of one. */
interface VenusLoreExtension {
  ref?: string
  fingerprint?: { keys: string; text: string }
  bg?: string
}

/** One entry of a SillyTavern World Info file, as this game writes it. */
interface WorldInfoEntry {
  uid: number
  key: string[]
  keysecondary: string[]
  comment: string
  content: string
  constant: boolean
  selective: boolean
  order: number
  position: number
  disable: boolean
  displayIndex: number
  addMemo: boolean
  excludeRecursion: boolean
  preventRecursion: boolean
  probability: number
  useProbability: boolean
  caseSensitive: boolean
  matchWholeWords: boolean
  extensions: { venus_university: VenusLoreExtension }
}

/** A SillyTavern World Info file: its entries by uid. */
export interface WorldInfoFile {
  entries: Record<string, WorldInfoEntry>
}

/** How a kept lorebook is checked once it has been read. */
export const LOREBOOK_READ: ValidateRecordOptions<LorebookRecord> = {
  label: LOREBOOK_FILE_NAME,
  malformed: {
    code: 'LOREBOOK_MALFORMED',
    message: "This playthrough's lorebook could not be read."
  },
  schemaVersion: { code: 'LOREBOOK_SCHEMA_VERSION' },
  expects: LOREBOOK_SCHEMA_VERSION,
  required: { schemaVersion: true, edits: true, custom: true }
}

/** What a lorebook the renderer handed over is refused with where it cannot be kept. */
export const LOREBOOK_INVALID = {
  code: 'LOREBOOK_INVALID',
  message: 'That lorebook could not be saved.'
}

/** One trigger word as it is kept: trimmed, every run of whitespace one space. */
function normalizeLoreKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Trigger words as they are kept: each normalized, blanks dropped, the first of any case kept. */
function normalizeLoreKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of keys) {
    const key = normalizeLoreKey(raw)
    const folded = key.toLowerCase()
    if (key === '' || seen.has(folded)) continue
    seen.add(folded)
    kept.push(key)
  }
  return kept
}

/** A description as it is kept: trimmed, its line breaks Unix. */
function normalizeLoreText(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').trim()
}

/** Why trigger words cannot be kept, or null where they can. */
export function loreKeysProblem(keys: readonly string[]): string | null {
  return normalizeLoreKeys(keys).length === 0 ? 'Add a trigger word' : null
}

/** Why a description cannot be kept, or null where it can. */
export function loreTextProblem(text: string): string | null {
  return normalizeLoreText(text) === '' ? 'Write a description' : null
}

/** Whether two key lists are the same words in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

/** Whether `keys` is a list of trigger words already kept as they would be. */
function keptKeys(keys: unknown): keys is string[] {
  return (
    Array.isArray(keys) &&
    keys.length > 0 &&
    keys.every((key) => typeof key === 'string') &&
    sameKeys(keys as string[], normalizeLoreKeys(keys as string[]))
  )
}

/** Whether `text` is a description already kept as it would be. */
function keptText(text: unknown): text is string {
  return typeof text === 'string' && text !== '' && text === normalizeLoreText(text)
}

/** Whether `value` is a plain object a record can be read out of. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Checks one parsed lorebook and hands back the fields this build reads; anything not exactly as
 * a write would have left it refuses the whole record, and nothing is defaulted. An edit of a
 * shipped entry this build does not know is kept for {@link normalizedLorebook} to drop.
 */
export function readLorebookRecord(
  parsed: unknown,
  where: string,
  malformed = LOREBOOK_READ.malformed
): LorebookRecord {
  const record = validateRecord<LorebookRecord>(parsed, where, { ...LOREBOOK_READ, malformed })
  const refuse = (why: string): never => {
    throw appError(malformed.code, `${LOREBOOK_FILE_NAME} ${why}.`, where)
  }
  if (!isPlainObject(record.edits)) refuse('keeps no edits')
  if (!Array.isArray(record.custom)) refuse('keeps no entries of its own')

  const edits: Record<string, LoreEdit> = {}
  for (const [ref, edit] of Object.entries(record.edits)) {
    if (!LORE_REF.test(ref) || ref in Object.prototype) refuse(`edits an entry named "${ref}"`)
    if (!isPlainObject(edit)) refuse(`keeps an unreadable edit of ${ref}`)
    const { keys, text } = edit as LoreEdit
    if (keys === undefined && text === undefined) refuse(`keeps an empty edit of ${ref}`)
    if (keys !== undefined && !keptKeys(keys)) refuse(`keeps unusable trigger words for ${ref}`)
    if (text !== undefined && !keptText(text)) refuse(`keeps an unusable description for ${ref}`)
    edits[ref] = {
      ...(keys !== undefined ? { keys: [...keys] } : {}),
      ...(text !== undefined ? { text } : {})
    }
  }

  const seen = new Set<string>()
  const custom = record.custom.map((entry: unknown): CustomLoreEntry => {
    if (!isPlainObject(entry)) return refuse('keeps an unreadable entry')
    const { id, keys, text, bg } = entry as Partial<CustomLoreEntry>
    if (typeof id !== 'string' || !CUSTOM_LORE_ID.test(id) || seen.has(id)) {
      refuse(`keeps an entry under the id "${String(id)}"`)
    }
    seen.add(id as string)
    if (!keptKeys(keys)) refuse(`keeps unusable trigger words for ${String(id)}`)
    if (!keptText(text)) refuse(`keeps an unusable description for ${String(id)}`)
    if (bg !== undefined && (typeof bg !== 'string' || !isSafeBgName(bg))) {
      refuse(`points ${String(id)} at an unusable background`)
    }
    return {
      id: id as string,
      keys: [...(keys as string[])],
      text: text as string,
      ...(bg !== undefined ? { bg } : {})
    }
  })

  return { schemaVersion: record.schemaVersion, edits, custom }
}

/** A playthrough's lorebook before the player has changed anything. */
export function emptyLorebook(): LorebookRecord {
  return { schemaVersion: LOREBOOK_SCHEMA_VERSION, edits: {}, custom: [] }
}

/** What the player changed of the shipped entry `ref`, if anything. */
export function editOf(record: LorebookRecord, ref: string): LoreEdit | undefined {
  return Object.hasOwn(record.edits, ref) ? record.edits[ref] : undefined
}

/** An edit with every field the build already ships taken out, or null where nothing is left. */
function trimmedEdit(edit: LoreEdit, shipped: ShippedLore): LoreEdit | null {
  const keys = edit.keys !== undefined && !sameKeys(edit.keys, shipped.keys) ? edit.keys : undefined
  const text = edit.text !== undefined && edit.text !== shipped.text ? edit.text : undefined
  if (keys === undefined && text === undefined) return null
  return { ...(keys !== undefined ? { keys } : {}), ...(text !== undefined ? { text } : {}) }
}

/**
 * The record read against this build: an edit of an entry the build no longer ships is dropped,
 * and so is any field the build now ships as the player wrote it. Hands back `record` itself
 * where nothing changed.
 */
export function normalizedLorebook(
  record: LorebookRecord,
  shipped: readonly ShippedLore[]
): LorebookRecord {
  const byRef = new Map(shipped.map((entry) => [entry.ref, entry]))
  const edits: Record<string, LoreEdit> = {}
  let changed = false
  for (const [ref, edit] of Object.entries(record.edits)) {
    const entry = byRef.get(ref)
    const kept = entry ? trimmedEdit(edit, entry) : null
    if (kept) edits[ref] = kept
    if (!kept || kept.keys !== edit.keys || kept.text !== edit.text) changed = true
  }
  return changed ? { ...record, edits } : record
}

/**
 * The record with `patch` laid over the player's edit of one shipped entry; a field equal to
 * what the build ships is kept as absent, and an edit left with nothing in it is gone.
 */
export function withShippedEdit(
  record: LorebookRecord,
  shipped: ShippedLore,
  patch: LoreEdit
): LorebookRecord {
  const current = editOf(record, shipped.ref) ?? {}
  const merged: LoreEdit = {
    ...current,
    ...(patch.keys !== undefined ? { keys: normalizeLoreKeys(patch.keys) } : {}),
    ...(patch.text !== undefined ? { text: normalizeLoreText(patch.text) } : {})
  }
  const kept = trimmedEdit(merged, shipped)
  const edits = { ...record.edits }
  if (kept) edits[shipped.ref] = kept
  else delete edits[shipped.ref]
  return { ...record, edits }
}

/** The record with one shipped entry back as the build ships it. */
export function withoutShippedEdit(record: LorebookRecord, ref: string): LorebookRecord {
  if (!Object.hasOwn(record.edits, ref)) return record
  const edits = { ...record.edits }
  delete edits[ref]
  return { ...record, edits }
}

/** The id the next entry of the player's is made under: one past the highest kept. */
function nextCustomLoreId(custom: readonly CustomLoreEntry[]): string {
  const highest = custom.reduce((most, entry) => Math.max(most, Number(entry.id.slice(6))), 0)
  return `custom${String(highest + 1)}`
}

/** The record with one more entry of the player's at the end, and the id it was made under. */
export function withCustomEntry(
  record: LorebookRecord,
  fields: { keys: readonly string[]; text: string; bg?: string }
): { record: LorebookRecord; id: string } {
  const id = nextCustomLoreId(record.custom)
  const entry: CustomLoreEntry = {
    id,
    keys: normalizeLoreKeys(fields.keys),
    text: normalizeLoreText(fields.text),
    ...(fields.bg !== undefined ? { bg: fields.bg } : {})
  }
  return { record: { ...record, custom: [...record.custom, entry] }, id }
}

/** The record with one entry of the player's changed; a `bg` of null takes its background off. */
export function withCustomPatch(
  record: LorebookRecord,
  id: string,
  patch: { keys?: readonly string[]; text?: string; bg?: string | null }
): LorebookRecord {
  return {
    ...record,
    custom: record.custom.map((entry) => {
      if (entry.id !== id) return entry
      const next: CustomLoreEntry = {
        id,
        keys: patch.keys !== undefined ? normalizeLoreKeys(patch.keys) : entry.keys,
        text: patch.text !== undefined ? normalizeLoreText(patch.text) : entry.text
      }
      const bg = patch.bg === undefined ? entry.bg : (patch.bg ?? undefined)
      return bg !== undefined ? { ...next, bg } : next
    })
  }
}

/** The record without one entry of the player's. */
export function withoutCustomEntry(record: LorebookRecord, id: string): LorebookRecord {
  return { ...record, custom: record.custom.filter((entry) => entry.id !== id) }
}

/** A short digest of one value, carried in an export to tell an untouched field from an edit. */
function loreFingerprint(value: string): string {
  return sha256Hex(value).slice(0, 16)
}

/** The fingerprint of a list of trigger words. */
function keysFingerprint(keys: readonly string[]): string {
  return loreFingerprint(JSON.stringify(keys))
}

/** One World Info entry, with SillyTavern's own switches set to match how this game reads it. */
function worldInfoEntry(
  index: number,
  keys: readonly string[],
  text: string,
  extension: VenusLoreExtension
): WorldInfoEntry {
  return {
    uid: index,
    key: [...keys],
    keysecondary: [],
    comment: keys[0] ?? '',
    content: text,
    constant: false,
    selective: true,
    order: 100,
    position: 0,
    disable: false,
    displayIndex: index,
    addMemo: true,
    // The game never lets one entry bring in another, so neither does SillyTavern.
    excludeRecursion: true,
    preventRecursion: true,
    probability: 100,
    useProbability: true,
    caseSensitive: false,
    matchWholeWords: true,
    extensions: { venus_university: extension }
  }
}

/**
 * The lorebook as a SillyTavern World Info file: the shipped entries in authored order as the
 * player has them, then his own. A shipped one carries its handle and a fingerprint of the words
 * the build shipped it with, so a later import can tell what was changed from what was not.
 */
export function worldInfoOf(
  record: LorebookRecord,
  shipped: readonly ShippedLore[]
): WorldInfoFile {
  const entries: Record<string, WorldInfoEntry> = {}
  let index = 0
  for (const entry of shipped) {
    const edit = editOf(record, entry.ref)
    const fingerprint = { keys: keysFingerprint(entry.keys), text: loreFingerprint(entry.text) }
    entries[String(index)] = worldInfoEntry(
      index,
      edit?.keys ?? entry.keys,
      edit?.text ?? entry.text,
      { ref: entry.ref, fingerprint }
    )
    index++
  }
  for (const entry of record.custom) {
    const extension = entry.bg ? { bg: entry.bg } : {}
    entries[String(index)] = worldInfoEntry(index, entry.keys, entry.text, extension)
    index++
  }
  return { entries }
}

/** A key SillyTavern reads as a regular expression, which this game cannot honour. */
const REGEX_KEY = /^\/.+\/[a-z]*$/

/** What a file that is no lorebook is refused with. */
function notAWorld(): never {
  throw appError('LOREBOOK_IMPORT_INVALID', 'That file is not a SillyTavern lorebook.')
}

/** This game's own extension on an entry of a World Info file, where it carries one. */
function venusExtensionOf(entry: Record<string, unknown>): VenusLoreExtension {
  const extensions = entry.extensions
  if (!isPlainObject(extensions) || !isPlainObject(extensions.venus_university)) return {}
  const { ref, fingerprint, bg } = extensions.venus_university
  return {
    ...(typeof ref === 'string' && LORE_REF.test(ref) ? { ref } : {}),
    ...(isPlainObject(fingerprint) &&
    typeof fingerprint.keys === 'string' &&
    typeof fingerprint.text === 'string'
      ? { fingerprint: { keys: fingerprint.keys, text: fingerprint.text } }
      : {}),
    ...(typeof bg === 'string' && isSafeBgName(bg) ? { bg } : {})
  }
}

/**
 * The entries of a parsed SillyTavern World Info file worth keeping: its primary keys, less any
 * regular expression, and its content. A disabled entry, and one of no shipped entry's with no
 * key or no content left, is counted as left out. Refuses anything that is not a World Info file.
 */
export function parseWorldInfo(parsed: unknown): WorldInfoImport {
  if (!isPlainObject(parsed) || !isPlainObject(parsed.entries)) notAWorld()
  const entries: ImportedLore[] = []
  let leftOut = 0
  for (const raw of Object.values((parsed as { entries: Record<string, unknown> }).entries)) {
    if (!isPlainObject(raw) || raw.disable === true) {
      leftOut++
      continue
    }
    const words = Array.isArray(raw.key)
      ? raw.key.filter((key): key is string => typeof key === 'string')
      : []
    const keys = normalizeLoreKeys(words.filter((key) => !REGEX_KEY.test(key.trim())))
    const text = typeof raw.content === 'string' ? normalizeLoreText(raw.content) : ''
    const extension = venusExtensionOf(raw)
    if (extension.ref === undefined && (keys.length === 0 || text === '')) {
      leftOut++
      continue
    }
    entries.push({ keys, text, ...extension })
  }
  return { entries, leftOut }
}

/** A World Info file's text read: a byte-order mark taken off, then parsed and its entries kept. */
export function parseWorldInfoText(text: string): WorldInfoImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    notAWorld()
  }
  return parseWorldInfo(parsed)
}

/** What an import leaves: the lorebook, how many entries came in, how many were left out. */
export interface AppliedImport {
  record: LorebookRecord
  imported: number
  leftOut: number
}

/**
 * The lorebook an import leaves. Replacing, it starts from nothing: the first entry carrying a
 * shipped handle sets that entry's edits, a field counting as edited only where it no longer
 * matches the fingerprint it was exported with, and every other usable entry becomes the player's
 * own. Adding, every entry carrying a handle is passed over and the rest are added after his own.
 * Refuses an import that would bring nothing in.
 */
export function applyImport(
  record: LorebookRecord,
  read: WorldInfoImport,
  shipped: readonly ShippedLore[],
  replace: boolean
): AppliedImport {
  const byRef = new Map(shipped.map((entry) => [entry.ref, entry]))
  const claimed = new Set<string>()
  let next = replace ? emptyLorebook() : record
  let imported = 0
  let leftOut = read.leftOut
  for (const entry of read.entries) {
    const usable = entry.keys.length > 0 && entry.text !== ''
    if (entry.ref !== undefined) {
      if (!replace) continue
      const target = byRef.get(entry.ref)
      if (target && !claimed.has(entry.ref)) {
        claimed.add(entry.ref)
        const print = entry.fingerprint
        const keysEdited = !print || keysFingerprint(entry.keys) !== print.keys
        const textEdited = !print || loreFingerprint(entry.text) !== print.text
        next = withShippedEdit(next, target, {
          ...(keysEdited && entry.keys.length > 0 ? { keys: entry.keys } : {}),
          ...(textEdited && entry.text !== '' ? { text: entry.text } : {})
        })
        imported++
        continue
      }
      // A second copy of a shipped entry is kept as the player's own; one the build no longer
      // ships is gone with it.
      if (!target || !usable) {
        leftOut++
        continue
      }
    }
    if (!usable) {
      leftOut++
      continue
    }
    next = withCustomEntry(next, {
      keys: entry.keys,
      text: entry.text,
      ...(entry.bg !== undefined ? { bg: entry.bg } : {})
    }).record
    imported++
  }
  if (imported === 0) {
    throw appError(
      'LOREBOOK_IMPORT_EMPTY',
      replace
        ? 'That lorebook holds no entries the game can use.'
        : 'That lorebook holds no entries of its own to add.'
    )
  }
  return { record: next, imported, leftOut }
}
