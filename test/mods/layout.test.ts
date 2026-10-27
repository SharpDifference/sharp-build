import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findInstalledMods } from '../../src/main/mods/layout'

/** Which version of each installed mod is in use, read from folders under a temp `data/mods`. */
let modsDir = ''

beforeEach(() => {
  modsDir = mkdtempSync(join(tmpdir(), 'vu-mods-'))
})

afterEach(() => {
  rmSync(modsDir, { recursive: true, force: true })
})

/** Unpacks an empty release of `id` at `version`. */
function install(id: string, version: string): void {
  mkdirSync(join(modsDir, id, version), { recursive: true })
  writeFileSync(join(modsDir, id, version, 'vxmod.json'), '{}')
}

function setCurrent(id: string, text: string): void {
  writeFileSync(join(modsDir, id, 'current'), text)
}

/** Every path under `dir`, relative to it. */
function listing(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()
}

describe('findInstalledMods', () => {
  it('picks the only version folder', () => {
    install('hello-mod', '1.0.0')
    const { mods, notes } = findInstalledMods(modsDir)
    expect(mods).toEqual([
      { id: 'hello-mod', version: '1.0.0', folder: join(modsDir, 'hello-mod', '1.0.0'), problem: null, notes: [] }
    ])
    expect(notes).toEqual([])
  })

  it('picks the version current names over a higher one', () => {
    install('hello-mod', '1.3.0')
    install('hello-mod', '1.4.0')
    setCurrent('hello-mod', '1.3.0\n')
    const [mod] = findInstalledMods(modsDir).mods
    expect(mod.version).toBe('1.3.0')
    expect(mod.notes).toEqual([])
  })

  it('reports a current that names a missing folder', () => {
    install('hello-mod', '1.4.0')
    setCurrent('hello-mod', '1.3.0')
    const [mod] = findInstalledMods(modsDir).mods
    expect(mod).toMatchObject({
      version: null,
      folder: join(modsDir, 'hello-mod'),
      problem: 'current names 1.3.0, which is not there'
    })
  })

  it('picks the highest of several versions with no current, and says so', () => {
    install('hello-mod', '1.10.0')
    install('hello-mod', '1.4.0')
    install('hello-mod', '1.9.2')
    setCurrent('hello-mod', '  \n')
    const [mod] = findInstalledMods(modsDir).mods
    expect(mod.version).toBe('1.10.0')
    expect(mod.notes).toEqual(['hello-mod: several versions and no "current"; using 1.10.0'])
  })

  it('reports a mod with no version folder, noting the folders it ignored', () => {
    mkdirSync(join(modsDir, 'hello-mod', 'old'), { recursive: true })
    const [mod] = findInstalledMods(modsDir).mods
    expect(mod).toMatchObject({ version: null, problem: 'no version folder', notes: ['hello-mod: ignored folder "old"'] })
  })

  it('skips a folder not named as a mod id, and stray files', () => {
    install('hello-mod', '1.0.0')
    install('Bad Name', '1.0.0')
    writeFileSync(join(modsDir, 'readme.txt'), 'hi')
    const { mods, notes } = findInstalledMods(modsDir)
    expect(mods.map((mod) => mod.id)).toEqual(['hello-mod'])
    expect(notes).toEqual(['skipped "Bad Name": not a mod id'])
  })

  it('finds no mods where the mods folder is missing', () => {
    expect(findInstalledMods(join(modsDir, 'nowhere'))).toEqual({ mods: [], notes: [] })
  })

  it('writes nothing', () => {
    install('hello-mod', '1.3.0')
    install('hello-mod', '1.4.0')
    install('other-mod', '2.0.0')
    setCurrent('other-mod', '9.9.9')
    mkdirSync(join(modsDir, 'Bad Name'))
    const before = listing(modsDir)
    findInstalledMods(modsDir)
    expect(listing(modsDir)).toEqual(before)
  })
})
