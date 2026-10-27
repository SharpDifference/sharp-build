import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import { zipSync } from 'fflate'
import { unpackRelease } from '../../src/main/mods/unpack'

/**
 * The fixture mods under `test/fixtures/mods/`, each laid out as a release's zip contents and
 * written by hand as built output. A test zips one as an author's release would be, then unpacks
 * it under `<root>/mods/<id>/<version>/`, which is how an install lays a mod out.
 */

export const FIXTURES = resolve(__dirname, '../fixtures/mods')

/** Every file under a folder, by its path relative to it with forward slashes. */
function filesUnder(folder: string, base = folder): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry)
    if (statSync(path).isDirectory()) Object.assign(files, filesUnder(path, base))
    else files[relative(base, path).split('\\').join('/')] = new Uint8Array(readFileSync(path))
  }
  return files
}

/** One fixture as its release zip. */
export function zipFixture(id: string): Uint8Array {
  return zipSync(filesUnder(join(FIXTURES, id)))
}

/** Installs one fixture under `<root>/mods/<id>/<version>/` the way an install does, and answers the version folder. */
export function installFixture(root: string, id: string, version = '1.0.0'): string {
  const folder = join(root, 'mods', id, version)
  unpackRelease(zipFixture(id), folder)
  return folder
}

/** Writes a mod folder's `current` file. */
export function setCurrent(root: string, id: string, version: string): void {
  mkdirSync(join(root, 'mods', id), { recursive: true })
  writeFileSync(join(root, 'mods', id, 'current'), `${version}\n`)
}

/** Every file under a folder with its bytes, for a before-and-after comparison of what a run touched. */
export function snapshot(folder: string): Record<string, string> {
  return Object.fromEntries(Object.entries(filesUnder(folder)).map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')]))
}
