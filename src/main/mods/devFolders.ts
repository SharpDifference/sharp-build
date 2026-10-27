import { BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron'
import { existsSync, watch, type FSWatcher } from 'fs'
import { resolve } from 'path'
import { appError } from '@shared/errors'
import { getSettings, patchStoredSettings } from '../services/settingsService'
import { looksLikeMod } from './loader'

/**
 * The developer setting: a mod loaded from a folder as it is built. The folders are
 * `settings.json`'s `devModFolders`, written here and nowhere else; each is watched while the
 * app runs, and a change is told to the session, which decides what the window is offered.
 */

/** How long after the last write to a folder the change counts, so a bundler's several writes count once. */
const DEBOUNCE_MS = 300

/** Which side of a mod a change touched: `main.js` needs a restart, anything else a reload. */
export type DevChangeKind = 'renderer' | 'main'

/** The watchers, by folder. */
const watchers = new Map<string, FSWatcher>()

/** Whether a burst of changed files includes the mod's own `main.js`, at the top of its folder. */
function kindOf(files: ReadonlySet<string>): DevChangeKind {
  return [...files].some((file) => file.replace(/\\/g, '/') === 'main.js') ? 'main' : 'renderer'
}

/** Watches one folder, telling `onChange` once per burst of writes. */
export function watchDevFolder(folder: string, onChange: (folder: string, kind: DevChangeKind, files: readonly string[]) => void): void {
  if (watchers.has(folder) || !existsSync(folder)) return
  let timer: NodeJS.Timeout | null = null
  const files = new Set<string>()
  try {
    const watcher = watch(folder, { recursive: true }, (_event, file) => {
      files.add(file === null ? '' : file.toString())
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        const changed = new Set(files)
        files.clear()
        onChange(folder, kindOf(changed), [...changed])
      }, DEBOUNCE_MS)
    })
    watcher.on('error', (err) => console.warn(`[mods] watching ${folder} failed:`, err))
    watchers.set(folder, watcher)
  } catch (err) {
    console.warn(`[mods] could not watch ${folder}:`, err)
  }
}

export function unwatchDevFolder(folder: string): void {
  watchers.get(folder)?.close()
  watchers.delete(folder)
}

/** The folders as stored. */
export async function devFolders(): Promise<string[]> {
  return (await getSettings()).devModFolders ?? []
}

/**
 * Asks for a folder holding an unzipped release and adds it to the setting; null where the
 * picker was dismissed. A folder with no `vxmod.json` is refused before anything is written.
 */
export async function addDevFolder(event: IpcMainInvokeEvent): Promise<string | null> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options = { title: 'Load a mod from a folder', properties: ['openDirectory' as const] }
  const { canceled, filePaths } = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
  if (canceled || filePaths.length === 0) return null
  const folder = resolve(filePaths[0])
  if (!looksLikeMod(folder)) {
    throw appError('MOD_FOLDER_INVALID', 'That folder has no vxmod.json, so it is not a mod.', folder)
  }
  await patchStoredSettings((settings) => {
    const folders = settings.devModFolders ?? []
    return folders.includes(folder) ? settings : { ...settings, devModFolders: [...folders, folder] }
  })
  return folder
}

export async function removeDevFolder(folder: string): Promise<void> {
  await patchStoredSettings((settings) => ({
    ...settings,
    devModFolders: (settings.devModFolders ?? []).filter((one) => one !== folder)
  }))
  unwatchDevFolder(folder)
}
