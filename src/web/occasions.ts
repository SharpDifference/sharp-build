import { appError } from '@shared/errors'
import {
  occasionsExportName,
  parseOccasionsFile,
  parseOccasionsFileText,
  type OccasionsFile,
  type OccasionsImport
} from '@shared/occasionsFile'
import { offerDownload } from './download'
import { pickFile } from './transfer'

/** Moving a New Game's occasions in and out of the browser, as an occasions file. */

/** Has the player pick an occasions file and reads its usable entries; `null` where dismissed. */
export async function importOccasionsFile(): Promise<OccasionsImport | null> {
  // First, so the browser's picker opens inside the click that asked for it.
  const file = await pickFile('.json,application/json')
  if (!file) return null
  let text: string
  try {
    text = await file.text()
  } catch (err) {
    throw appError('OCCASIONS_IMPORT_UNREADABLE', 'That file could not be read.', String(err))
  }
  return parseOccasionsFileText(text)
}

/** Offers the occasions as a file, which the game itself would accept back. */
export function exportOccasionsFile(occasions: OccasionsFile): null {
  const { season } = parseOccasionsFile(occasions)
  offerDownload(occasionsExportName(season), JSON.stringify(occasions, null, 2), 'application/json')
  return null
}
