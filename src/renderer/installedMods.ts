/**
 * The installed mods' entries, added to `MODS` before any other module of the window can read
 * the list: imported first in `main.tsx`, after the console, because ES imports evaluate first.
 * The table comes from the preload, which read it from main synchronously, and holds the
 * manifests alone; no mod code runs here.
 */

import { installMods } from '@shared/mods'
import { EMPTY_SESSION, type ModSessionTable } from '@shared/modSession'

// Read off `globalThis`: the tests load the stores with a bridge of their own and no window.
const win = (globalThis as { window?: Window }).window

/** The table as the window started with it; the browser build's is empty. */
export const startTable: ModSessionTable = win?.api?.mods?.session ?? EMPTY_SESSION

installMods(startTable.mods.flatMap((mod) => (mod.def ? [mod.def] : [])))

// Shift held at start skips every installed mod's renderer code: a mod whose `renderer.js` hangs
// at its top level would otherwise freeze the boot, and an import cannot be timed out. The key is
// read off the window's own events, so it is seen once the window has focus; a key held before
// the window appears arrives through its repeat.
let shiftHeld = false
win?.addEventListener?.('keydown', (event) => void (event.key === 'Shift' && (shiftHeld = true)), true)
win?.addEventListener?.('keyup', (event) => void (event.key === 'Shift' && (shiftHeld = false)), true)
win?.addEventListener?.('blur', () => void (shiftHeld = false))

/** Whether Shift is down right now. */
export function shiftIsHeld(): boolean {
  return shiftHeld
}
