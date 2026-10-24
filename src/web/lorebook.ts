import { appError } from '@shared/errors'
import {
  parseWorldInfo,
  parseWorldInfoText,
  WORLD_INFO_EXPORT_NAME,
  type WorldInfoFile,
  type WorldInfoImport
} from '@shared/lorebookRecord'
import { offerDownload } from './download'
import { pickFile } from './transfer'

/** Moving a lorebook between this game and SillyTavern, as a World Info file. */

/** Has the player pick a World Info file and reads its usable entries; `null` where dismissed. */
export async function importWorldInfo(): Promise<WorldInfoImport | null> {
  // First, so the browser's picker opens inside the click that asked for it.
  const file = await pickFile('.json,application/json')
  if (!file) return null
  let text: string
  try {
    text = await file.text()
  } catch (err) {
    throw appError('LOREBOOK_IMPORT_UNREADABLE', 'That file could not be read.', String(err))
  }
  return parseWorldInfoText(text)
}

/** Offers the lorebook as a World Info file, which the game itself would accept back. */
export function exportWorldInfo(world: WorldInfoFile): null {
  parseWorldInfo(world)
  offerDownload(WORLD_INFO_EXPORT_NAME, JSON.stringify(world, null, 2), 'application/json')
  return null
}
