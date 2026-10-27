import { mkdir } from 'fs/promises'
import { cleanSwitches, modOn, NO_SWITCHES, type ModSwitches } from '@shared/mods'
import { setSharedModRules } from '@shared/modRules'
import { getDataPath, getModsPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'

/** Schema version this build reads and writes. */
const SCHEMA_VERSION = 1

/**
 * The switches main last read or wrote. Shared rules ask them here, as the renderer's ask its own
 * store: main knows no playthrough, so a `playthrough` mod answers as its switch stands.
 */
let known: ModSwitches = NO_SWITCHES
setSharedModRules((modId) => modOn(known, modId))

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
  known = cleanSwitches(file)
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
  known = cleanSwitches(switches)
}
