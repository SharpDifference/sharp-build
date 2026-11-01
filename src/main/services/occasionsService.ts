import { readFile } from 'fs/promises'
import { appError, messageOf } from '@shared/errors'
import {
  parseOccasionsFileText,
  type OccasionsFile,
  type OccasionsImport
} from '@shared/occasionsFile'
import { writeAtomicJson } from './jsonFile'

/** The occasions files a New Game's calendar is imported from and exported to. */

/** The season and usable entries of the occasions file at `path`. */
export async function readOccasionsFile(path: string): Promise<OccasionsImport> {
  let text: string
  try {
    text = await readFile(path, 'utf-8')
  } catch (err) {
    throw appError('OCCASIONS_IMPORT_UNREADABLE', 'That file could not be read.', messageOf(err))
  }
  return parseOccasionsFileText(text)
}

/** Writes the occasions file to `path`, where the native save dialog pointed. */
export async function writeOccasionsFile(path: string, file: OccasionsFile): Promise<void> {
  await writeAtomicJson(path, file, {
    code: 'OCCASIONS_EXPORT_FAILED',
    message: 'Could not save the occasions.'
  })
}
