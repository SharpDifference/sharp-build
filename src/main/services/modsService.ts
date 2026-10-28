import { mkdir, readFile } from 'fs/promises'
import {
  cleanSwitches,
  modOn,
  NO_SWITCHES,
  photoSwitchesOf,
  withPhotoSettingsCarried,
  type ModSwitches
} from '@shared/mods'
import { EMPTY_SESSION, isRunning, type ModSessionTable } from '@shared/modSession'
import { setSharedModRules } from '@shared/modRules'
import { setPhotoSwitches } from '@shared/photoSwitches'
import { getDataPath, getModsPath, getSettingsPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'

/** Schema version this build reads and writes. */
const SCHEMA_VERSION = 1

/**
 * The switches main last read or wrote. Shared rules ask them here, as the renderer's ask its own
 * store: main knows no playthrough, so a `playthrough` mod answers as its switch stands. The rule
 * reads `MODS`, which holds the installed mods once the mod session has added them, and an
 * installed mod that is not running this session (its `main.js` threw after registering, say)
 * answers off whatever its switch, as the window's rule has it.
 */
let known: ModSwitches = NO_SWITCHES
/** The session table as main holds it; until the loader binds it, nothing is installed. */
let session: () => ModSessionTable = () => EMPTY_SESSION
setSharedModRules((modId) => isRunning(session(), modId) && modOn(known, modId))

/** Binds the shared rules to the mod session's table, read live so a rerun of the checks counts. */
export function bindModSession(lookup: () => ModSessionTable): void {
  session = lookup
}

/** `data/mods.json` as it is on disk. */
interface ModsFile extends ModSwitches {
  schemaVersion: number
}

/**
 * Reads `/data/mods.json`: which community mods the player has switched on and off, and their
 * options. With no file yet, every mod is at its default.
 */
export async function getModSwitches(): Promise<ModSwitches> {
  const file = await readValidatedJson<ModsFile>(getModsPath(), {
    label: 'mods.json',
    unreadable: { code: 'MODS_UNREADABLE', message: 'Could not read mods.json.' },
    malformed: {
      code: 'MODS_MALFORMED',
      message: 'mods.json is not valid JSON. Fix or delete the file to continue.'
    },
    schemaVersion: { code: 'MODS_SCHEMA_VERSION' },
    expects: SCHEMA_VERSION,
    required: { schemaVersion: true },
    onMissing: () => ({ schemaVersion: SCHEMA_VERSION, ...NO_SWITCHES })
  })
  const stored = cleanSwitches(file)
  const switches = withPhotoSettingsCarried(stored, await settingsToCarry())
  // Carried once and kept here: the game's next settings save drops what it does not know.
  if (switches !== stored) await setModSwitches(switches)
  // Main's own copy of Photo Feature's switches, for the renders it draws (body details).
  setPhotoSwitches(photoSwitchesOf(switches))
  known = cleanSwitches(switches)
  return known
}

/** Writes every switch and option atomically. */
export async function setModSwitches(switches: ModSwitches): Promise<void> {
  await mkdir(getDataPath(), { recursive: true })
  await writeAtomicJson(
    getModsPath(),
    { schemaVersion: SCHEMA_VERSION, ...cleanSwitches(switches) },
    { code: 'MODS_UNWRITABLE', message: 'Could not save mods.json.' }
  )
  setPhotoSwitches(photoSwitchesOf(switches))
  known = cleanSwitches(switches)
}

/**
 * What 1.1.3 left in the game's `settings.json` for Photo Feature, read straight off the file:
 * the game's settings no longer know these keys. None where the file cannot be read.
 */
async function settingsToCarry(): Promise<Record<string, unknown>> {
  try {
    const raw: unknown = JSON.parse(await readFile(getSettingsPath(), 'utf-8'))
    if (!raw || typeof raw !== 'object') return {}
    const { photos, photoLoader, bodyDetails } = raw as Record<string, unknown>
    return { photos, photoLoader, bodyDetails }
  } catch {
    return {}
  }
}
