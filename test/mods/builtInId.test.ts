import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import { loadMods } from '../../src/main/mods/loader'
import { FIXTURES, installFixture } from './fixtureMods'

/**
 * An installed copy of a mod the build already carries: refused, listed by its folder with no
 * definition, so the build's own copy keeps running and no hook is answered twice. Its own file,
 * because `installMods` adds to the list for the whole run.
 */

let root = ''

const BUILT_IN: ModDef = { id: 'hello-mod', name: 'Hello mod', author: 'a', version: '2.0.0', scope: 'anytime', defaultOn: true, blurb: '' }

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-builtin-'))
  installMods([BUILT_IN])
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('an installed mod whose id the build carries', () => {
  it('is refused as already part of this build, standing for no mod, from a folder and from a developer folder alike', () => {
    installFixture(root, 'hello-mod')
    const result = loadMods({
      modsDir: join(root, 'mods'),
      devFolders: [join(FIXTURES, 'hello-mod')],
      allowUnreviewedMain: true,
      coreVersion: '0.1.0',
      gameVersion: '0.6.0',
      safeStart: null,
      log: () => {},
      warn: () => {}
    })
    const rows = result.table.mods.filter((mod) => mod.id === 'hello-mod')
    expect(rows.map((row) => [row.dev, row.status, row.message, row.def])).toEqual([
      [false, 'refused', 'already part of this build', null],
      [true, 'refused', 'already part of this build', null]
    ])
    expect(result.table.order).toEqual([])
    expect(result.served.has('hello-mod')).toBe(false)
    expect(result.routes.has('hello-mod')).toBe(false)
  })
})
