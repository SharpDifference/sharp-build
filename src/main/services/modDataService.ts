import { existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { MOD_ID_RULE, RESERVED_MOD_IDS } from '@vx/modkit/host/shared'
import { appError } from '@shared/errors'
import { modById } from '@shared/mods'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { getDataPath, getModDataPath, getPlaythroughModDataPath, getPlaythroughPath } from '../paths'
import { installedManifest } from './modsService'

/** A mod's own files outside the save: where they sit, and who the mod is to the player. */

/** Refuses an id no mod could have. */
export function assertModId(modId: string): void {
  if (typeof modId !== 'string' || !MOD_ID_RULE.test(modId) || RESERVED_MOD_IDS.includes(modId)) {
    throw appError('MOD_ID_INVALID', 'That mod id is not valid.', String(modId))
  }
}

/** The mod's name as the player knows it, for a message; its id where neither the session nor the build lists it. */
export function modNameOf(modId: string): string {
  return installedManifest(modId)?.name ?? modById(modId)?.name ?? modId
}

/** The version a mod's data is stamped with: the installed manifest's, the build's, or `0.0.0`. */
export function modVersionOf(modId: string): string {
  return installedManifest(modId)?.version ?? modById(modId)?.version ?? '0.0.0'
}

/**
 * The folder a mod keeps its own files in, created on the first call: `data/mod-data/<id>`, or
 * with a playthrough `data/saves/<playthroughId>/mod-data/<id>`; where the installed mod's
 * manifest declares a `dataPath`, the folder it names there instead. A playthrough's folder must
 * already be there: this never makes one.
 */
export function modDataPath(modId: string, playthroughId?: string): string {
  assertModId(modId)
  const declared = installedManifest(modId)?.dataPath
  let path: string
  if (playthroughId === undefined) {
    path = declared?.data ? join(getDataPath(), ...declared.data.split('/')) : getModDataPath(modId)
  } else {
    assertSafePlaythroughId(playthroughId)
    if (!existsSync(getPlaythroughPath(playthroughId))) {
      throw appError('MOD_DATA_NO_PLAYTHROUGH', 'That playthrough is not here.', playthroughId)
    }
    path = declared?.playthrough
      ? join(getPlaythroughPath(playthroughId), ...declared.playthrough.split('/'))
      : getPlaythroughModDataPath(playthroughId, modId)
  }
  mkdirSync(path, { recursive: true })
  return resolve(path)
}
