import { mkdtemp, mkdir, readdir, rm, access } from 'fs/promises'
import { join } from 'path'
import {
  extractZip, modDataPath, requiredBackupPart,
  type BackupPart, type BackupPartLegacy
} from '@vx/modkit/main'
import { appError, BACKUP_ZIP_LIMITS, SAFE_CHAR_ID, SAFE_NUMERIC_ID } from '@vx/modkit/shared'
import { isPhotoSidecar } from '../shared/photoFiles'
import {
  copyPhotoFile, getPhotoPath, getPhotosRoot, isPhotoImage, legacyPhotosRoot, movePhotoFiles,
  photoCharacters, photoFileRendering, photoNames, readPhotoSidecar
} from './photoFiles'

/** Photo's required share of a backup, including its older companion archives. */

/** The companion archive older Photo versions kept beside the game's backup. */
export function localPhotosBackupPath(backup: string): string {
  return backup.replace(/(\.zip)?$/i, '.photos.zip')
}

/** Recognizes only a Photo image or sidecar under its playthrough and character. */
function entryOf(rel: string): { pid: string; charId: string; file: string } | null {
  const [pid, charId, file, ...rest] = rel.replaceAll('\\', '/').split('/')
  if (rest.length || !SAFE_NUMERIC_ID.test(pid ?? '') || !SAFE_CHAR_ID.test(charId ?? '') ||
      !(isPhotoImage(file ?? '') || isPhotoSidecar(file ?? ''))) return null
  return { pid, charId, file }
}

/** Lists extracted regular files without following links. */
async function filesUnder(root: string, prefix = ''): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...await filesUnder(root, rel))
    else if (entry.isFile()) files.push(rel)
    else throw appError('PHOTO_BACKUP_INVALID', 'The photo backup contains a link or special file.')
  }
  return files
}

/** Stages an older companion under Photo's own folder, with the guarded backup limits. */
async function legacyFiles(legacy: BackupPartLegacy, stage: string): Promise<string[]> {
  const archive = localPhotosBackupPath(legacy.archive)
  try { await access(archive) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const extracted = join(stage, '.legacy')
  await mkdir(extracted)
  await extractZip(archive, extracted, BACKUP_ZIP_LIMITS)
  const files = await filesUnder(extracted)
  for (const rel of files) {
    const entry = entryOf(rel)
    if (!entry) continue
    if (isPhotoSidecar(entry.file) && !(await readPhotoSidecar(join(extracted, rel)))) continue
    await copyPhotoFile(join(extracted, rel), join(stage, rel))
  }
  await rm(extracted, { recursive: true, force: true })
  return filesUnder(stage)
}

export const photoBackupPart: BackupPart = {
  export: async ({ scratch, playthroughIds }) => {
    const files: string[] = []
    for (const pid of playthroughIds) {
      await movePhotoFiles(pid)
      const copied = new Set<string>()
      for (const root of [getPhotosRoot(pid), legacyPhotosRoot(pid)]) {
        for (const charId of await photoCharacters(root)) {
          for (const file of await photoNames(join(root, charId))) {
            const rel = `${pid}/${charId}/${file}`
            if (photoFileRendering(pid, charId, file)) continue
            const source = join(root, charId, file)
            // Old or unreadable metadata never makes a finished image optional.
            if (isPhotoSidecar(file) && !(await readPhotoSidecar(source))) continue
            await copyPhotoFile(source, join(scratch, pid, charId, file))
            if (!copied.has(rel)) {
              copied.add(rel)
              files.push(rel)
            }
          }
        }
      }
    }
    return { json: { schemaVersion: 1 }, files }
  },
  prepare: async (json, files, legacy) => {
    const stage = await mkdtemp(join(modDataPath('photo-feature'), '.restore-'))
    try {
      let names: string[]
      if (json === undefined && files.list.length === 0) {
        names = await legacyFiles(legacy, stage)
      } else {
        if (!json || typeof json !== 'object' || !('schemaVersion' in json) || json.schemaVersion !== 1) {
          throw appError('PHOTO_BACKUP_INVALID', 'The photo backup format is not supported.')
        }
        names = []
        for (const rel of files.list) {
          const entry = entryOf(rel)
          if (!entry) throw appError('PHOTO_BACKUP_INVALID', 'The photo backup has an invalid filename.')
          const source = join(files.dir, rel)
          if (isPhotoSidecar(entry.file) && !(await readPhotoSidecar(source))) continue
          await copyPhotoFile(source, join(stage, entry.pid, entry.charId, entry.file))
          names.push(rel)
        }
      }
      return {
        commit: async () => {
          try {
            for (const rel of names) {
              const entry = entryOf(rel)!
              let dest: string
              try { dest = getPhotoPath(entry.pid, entry.charId, entry.file) }
              catch (error) {
                if ((error as { code?: string }).code === 'MOD_DATA_NO_PLAYTHROUGH') continue
                throw error
              }
              await copyPhotoFile(join(stage, rel), dest)
            }
          } finally { await rm(stage, { recursive: true, force: true }) }
        },
        discard: () => rm(stage, { recursive: true, force: true })
      }
    } catch (error) {
      await rm(stage, { recursive: true, force: true })
      throw error
    }
  }
}

requiredBackupPart('photo-feature', photoBackupPart)
