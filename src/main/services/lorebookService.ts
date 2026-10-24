import { readFile } from 'fs/promises'
import { appError, messageOf } from '@shared/errors'
import {
  LOREBOOK_INVALID,
  LOREBOOK_READ,
  parseWorldInfoText,
  readLorebookRecord,
  type LorebookRecord,
  type WorldInfoFile,
  type WorldInfoImport
} from '@shared/lorebookRecord'
import { getLorebookPath } from '../paths'
import { readJsonFile, writeAtomicJson } from './jsonFile'
import { assertSafePlaythroughId, playthroughExists } from './saveService'

/**
 * A playthrough's own lorebook on disk, kept beside its record and never made before the
 * playthrough's folder exists; and the SillyTavern files it is imported from and exported to.
 */

/** The lorebook one playthrough keeps, checked; `null` where it keeps none. */
export async function readLorebook(playthroughId: string): Promise<LorebookRecord | null> {
  assertSafePlaythroughId(playthroughId)
  const path = getLorebookPath(playthroughId)
  const read = await readJsonFile<null>(path, {
    malformed: LOREBOOK_READ.malformed,
    unreadable: {
      code: 'LOREBOOK_UNREADABLE',
      message: "Could not read this playthrough's lorebook."
    },
    onMissing: () => null
  })
  if (read.kind === 'missing') return null
  return readLorebookRecord(read.parsed, path)
}

/** Keeps the lorebook whole beside a playthrough that still exists; the folder is never made. */
export async function writeLorebook(playthroughId: string, lorebook: unknown): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  const record = readLorebookRecord(lorebook, 'lorebook', LOREBOOK_INVALID)

  if (!(await playthroughExists(playthroughId))) {
    throw appError('LOREBOOK_PLAYTHROUGH_GONE', 'That playthrough no longer exists.')
  }

  await writeAtomicJson(getLorebookPath(playthroughId), record, {
    code: 'LOREBOOK_UNWRITABLE',
    message: 'Could not save the lorebook.'
  })
}

/** The usable entries of the SillyTavern lorebook at `path`. */
export async function readWorldInfoFile(path: string): Promise<WorldInfoImport> {
  let text: string
  try {
    text = await readFile(path, 'utf-8')
  } catch (err) {
    throw appError('LOREBOOK_IMPORT_UNREADABLE', 'That file could not be read.', messageOf(err))
  }
  return parseWorldInfoText(text)
}

/** Writes the World Info file to `path`, where the native save dialog pointed. */
export async function writeWorldInfoFile(path: string, world: WorldInfoFile): Promise<void> {
  await writeAtomicJson(path, world, {
    code: 'LOREBOOK_EXPORT_FAILED',
    message: 'Could not save the lorebook.'
  })
}
