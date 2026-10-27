import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import { unzipSync } from 'fflate'

/**
 * Unpacks a release zip as it came into one folder: what the installer will do under
 * `data/mods/<id>/<version>/`, written here once so the loader's tests lay a fixture out exactly
 * as an install does. An entry that would land outside the folder refuses the whole zip before
 * anything is written.
 */
export function unpackRelease(zip: Uint8Array, folder: string): void {
  const files = unzipSync(zip)
  const root = resolve(folder)
  const planned: [string, Uint8Array][] = []
  for (const [name, bytes] of Object.entries(files)) {
    // A folder entry has nothing to write; its files make it.
    if (name.endsWith('/')) continue
    if (name.includes('\\') || name.includes('\0') || /^[A-Za-z]:/.test(name)) {
      throw new Error(`the zip names a file that is not a plain path: ${name}`)
    }
    const target = resolve(root, name)
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`the zip names a file outside its folder: ${name}`)
    }
    planned.push([target, bytes])
  }
  for (const [target, bytes] of planned) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
  }
  mkdirSync(join(root), { recursive: true })
}
