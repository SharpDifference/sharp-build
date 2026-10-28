import { MOD_ID_RULE } from '@vx/modkit/host/shared'

/**
 * Where a mod's own files sit inside an archive the game writes (a backup, a character export):
 * `mods/<mod id>/<the mod's own path>`, each name in it one a folder can hold.
 */

/** The folder a mod's own files sit under inside an archive. */
export const MOD_PARTS_DIR = 'mods'

/** One name of a path inside an archive that a folder can hold: not empty, not `.` or `..`, nothing a path or Windows would read otherwise. */
export function isSafeEntryName(name: string): boolean {
  if (name === '' || name === '.' || name === '..') return false
  if (name.endsWith('.') || name.endsWith(' ')) return false
  return !/[\\/:*?"<>|\u0000-\u001f]/.test(name)
}

/** Whose file `name` is and where it sits in the mod's folder, for `mods/<id>/<path>`; null for anything else. */
export function modPartEntryOf(name: string): { modId: string; rel: string } | null {
  const parts = name.split('/')
  if (parts.length < 3 || parts[0] !== MOD_PARTS_DIR) return null
  const [, modId, ...rest] = parts
  if (!MOD_ID_RULE.test(modId) || !rest.every(isSafeEntryName)) return null
  return { modId, rel: rest.join('/') }
}
