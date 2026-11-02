import type { ApplicationDraft, PlannedOccasion } from './application'
import { FINAL_DATE } from './classes'
import { appError } from './errors'
import type { FixedOccasionEdit, FixedOccasionEdits, Season, TimeSlot } from './types'

/**
 * A semester's occasions as a file the player keeps and brings back: each invented one's kind,
 * its days and half or whole day, and the words written for it, and the changes made to the fixed
 * ones, a fixed one taken off the semester among them. Ids,
 * inspiration words and briefs are the build's, minted afresh as a file is read in.
 */

export const OCCASIONS_FILE_FORMAT = 'venus-university-occasions'

const OCCASIONS_FILE_VERSION = 1

/** The four named events a semester invents. */
export const NAMED_OCCASION_KINDS = ['gala', 'dance', 'career-fair', 'concert'] as const
export type NamedOccasionKind = (typeof NAMED_OCCASION_KINDS)[number]

/** What an occasion in the file can be: a named event, or a small thing. */
export const OCCASION_KINDS = [...NAMED_OCCASION_KINDS, 'small-event'] as const
export type OccasionKind = (typeof OCCASION_KINDS)[number]

/** The most occasions one file brings in, of either kind. */
export const MAX_FILE_OCCASIONS = 40

/** The first day an occasion that moves may cover: the authored first day keeps to itself. */
export const OCCASION_FIRST_DAY = 1

/** The last day an occasion that moves may cover: graduation day keeps to itself. */
export const OCCASION_LAST_DAY = FINAL_DATE - 1

/** One occasion as the file carries it. */
export interface OccasionsFileEntry {
  kind: OccasionKind
  startDate: number
  endDate: number
  /** Null for the whole of each day. */
  time: TimeSlot | null
  title: string
  description: string
}

/** One fixed occasion's changes as the file carries them. */
export interface OccasionsFileFixed extends FixedOccasionEdit {
  id: string
}

/** The occasions file; `fixed` is absent where no fixed occasion was changed. */
export interface OccasionsFile {
  format: typeof OCCASIONS_FILE_FORMAT
  schemaVersion: typeof OCCASIONS_FILE_VERSION
  season: Season
  occasions: OccasionsFileEntry[]
  fixed?: OccasionsFileFixed[]
}

/**
 * What a read file leaves: its season, the invented entries and the fixed changes worth keeping,
 * and how many of either were left out.
 */
export interface OccasionsImport {
  season: Season
  entries: OccasionsFileEntry[]
  fixed: OccasionsFileFixed[]
  leftOut: number
}

/** What an exported occasions file is offered under. */
export function occasionsExportName(season: Season): string {
  return `Venus University ${season === 'spring' ? 'Spring' : 'Fall'} Occasions.json`
}

/** What a file that is no occasions file is refused with. */
function notOccasions(): never {
  throw appError('OCCASIONS_IMPORT_INVALID', 'That file is not a Venus University occasions file.')
}

/** Whether `value` is a plain object an entry can be read out of. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether `value` is a day an occasion that moves may cover. */
function isOccasionDay(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= OCCASION_FIRST_DAY &&
    (value as number) <= OCCASION_LAST_DAY
  )
}

/** One field's words, `''` where it is absent; null where it is there and not text. */
function wordsOf(value: unknown): string | null {
  if (value === undefined) return ''
  return typeof value === 'string' ? value : null
}

/** One raw entry as the file's entry, or null where it cannot be placed on the calendar. */
function entryOf(raw: unknown): OccasionsFileEntry | null {
  if (!isPlainObject(raw)) return null
  const { kind, startDate, endDate, time } = raw
  if (!OCCASION_KINDS.includes(kind as OccasionKind)) return null
  if (!isOccasionDay(startDate) || !isOccasionDay(endDate) || endDate < startDate) return null
  if (time !== 0 && time !== 1 && time !== null) return null
  const title = wordsOf(raw.title)
  const description = wordsOf(raw.description)
  if (title === null || description === null) return null
  return { kind: kind as OccasionKind, startDate, endDate, time, title, description }
}

/**
 * One raw fixed change as the file's, or null where it is not one: an id, and words that are
 * text, a start that is a day an occasion may move to and a removal, each optional. Whether the
 * season has that occasion and lets it move there or be removed is the game's to say.
 */
function fixedOf(raw: unknown): OccasionsFileFixed | null {
  if (!isPlainObject(raw)) return null
  const { id, title, description, startDate, removed } = raw
  if (typeof id !== 'string' || id === '') return null
  if (title !== undefined && typeof title !== 'string') return null
  if (description !== undefined && typeof description !== 'string') return null
  if (startDate !== undefined && !isOccasionDay(startDate)) return null
  if (removed !== undefined && removed !== true) return null
  return {
    id,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(removed === true ? { removed } : {})
  }
}

/**
 * The entries of a parsed occasions file worth keeping, at most {@link MAX_FILE_OCCASIONS} of
 * each kind: an invented one of a known kind on days an occasion may cover, in order, on a day or
 * night half or the whole day, and a fixed change {@link fixedOf} reads, the first for its id. Every other entry is
 * counted as left out. Refuses anything that is not an occasions file.
 */
export function parseOccasionsFile(parsed: unknown): OccasionsImport {
  if (!isPlainObject(parsed)) notOccasions()
  const { format, schemaVersion, season, occasions, fixed } = parsed as Record<string, unknown>
  if (format !== OCCASIONS_FILE_FORMAT || schemaVersion !== OCCASIONS_FILE_VERSION) notOccasions()
  if ((season !== 'spring' && season !== 'fall') || !Array.isArray(occasions)) notOccasions()
  if (fixed !== undefined && !Array.isArray(fixed)) notOccasions()
  const entries: OccasionsFileEntry[] = []
  let leftOut = 0
  for (const raw of occasions as unknown[]) {
    const entry = entryOf(raw)
    if (entry && entries.length < MAX_FILE_OCCASIONS) entries.push(entry)
    else leftOut++
  }
  const changes: OccasionsFileFixed[] = []
  for (const raw of (fixed as unknown[] | undefined) ?? []) {
    const change = fixedOf(raw)
    const repeated = change !== null && changes.some((kept) => kept.id === change.id)
    if (change && !repeated && changes.length < MAX_FILE_OCCASIONS) changes.push(change)
    else leftOut++
  }
  return { season: season as Season, entries, fixed: changes, leftOut }
}

/** An occasions file's text read: a byte-order mark taken off, then parsed and its entries kept. */
export function parseOccasionsFileText(text: string): OccasionsImport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    notOccasions()
  }
  return parseOccasionsFile(parsed)
}

/** Where a half sorts among a day's occasions: the whole day first, then day, then night. */
export function halfOrder(time: TimeSlot | null): number {
  return time ?? -1
}

/**
 * An application's planned occasions as a file, in date order, with the words as the player
 * typed them, and `fixedEdits` as the changes to the fixed ones; `kindOf` reads each planned
 * one's kind, and one it names none for is not carried.
 */
export function occasionsFileOf(
  draft: Pick<ApplicationDraft, 'season' | 'plan' | 'occasions'>,
  kindOf: (planned: PlannedOccasion) => OccasionKind | null,
  fixedEdits: Readonly<FixedOccasionEdits>
): OccasionsFile {
  const planned = [...draft.plan].sort(
    (a, b) => a.startDate - b.startDate || halfOrder(a.time) - halfOrder(b.time)
  )
  const occasions = planned.flatMap((entry): OccasionsFileEntry[] => {
    const kind = kindOf(entry)
    if (kind === null) return []
    const words = draft.occasions[entry.id]
    return [
      {
        kind,
        startDate: entry.startDate,
        endDate: entry.endDate,
        time: entry.time,
        title: words?.title ?? '',
        description: words?.description ?? ''
      }
    ]
  })
  const fixed = Object.entries(fixedEdits).map(([id, edit]) => ({ id, ...edit }))
  return {
    format: OCCASIONS_FILE_FORMAT,
    schemaVersion: OCCASIONS_FILE_VERSION,
    season: draft.season,
    occasions,
    ...(fixed.length > 0 ? { fixed } : {})
  }
}
