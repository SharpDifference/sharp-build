import { mkdir, mkdtemp, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModSessionTable } from '@shared/modSession'

/**
 * Where a mod keeps its own files outside the save: a folder of its own under `data/` or under a
 * playthrough, or the one its manifest declares from before, never one of the game's own.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

const { modDataPath } = await import('../src/main/services/modDataService')
const { bindModSession } = await import('../src/main/services/modsService')
const { CORE_DATA_NAMES, CORE_PLAYTHROUGH_NAMES, parseManifest } = await import('@vx/modkit/host/shared')
const paths = await import('../src/main/paths')

const PLAYTHROUGH = '1700000000000'

/** A manifest as an installed mod's folder would hold it, with `extra` on top. */
function manifestJson(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    manifest: 1,
    id: 'music-mod',
    name: 'Music',
    author: 'test',
    version: '1.0.0',
    blurb: 'Songs.',
    source: 'https://example.com',
    kit: '^0.3.0',
    hooks: [],
    main: false,
    scope: 'anytime',
    defaultOn: true,
    ...extra
  }
}

function installed(extra: Record<string, unknown>): void {
  const parsed = parseManifest(manifestJson(extra))
  if (!parsed.ok) throw new Error(parsed.error)
  const table = { mods: [{ id: 'music-mod', manifest: parsed.manifest }] } as unknown as ModSessionTable
  bindModSession(() => table)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-university-mod-data-'))
  await mkdir(paths.getPlaythroughPath(PLAYTHROUGH), { recursive: true })
})

afterEach(async () => {
  bindModSession(() => ({ mods: [] }) as unknown as ModSessionTable)
  await rm(root, { recursive: true, force: true })
})

describe('modDataPath', () => {
  it("makes the mod's own folder under data and under a playthrough", async () => {
    const own = modDataPath('music-mod')
    expect(own).toBe(join(paths.getDataPath(), 'mod-data', 'music-mod'))
    expect((await stat(own)).isDirectory()).toBe(true)
    const inGame = modDataPath('music-mod', PLAYTHROUGH)
    expect(inGame).toBe(join(paths.getPlaythroughPath(PLAYTHROUGH), 'mod-data', 'music-mod'))
    expect((await stat(inGame)).isDirectory()).toBe(true)
  })

  it('resolves to the folders an installed manifest declares', () => {
    installed({ dataPath: { data: 'ex-music', playthrough: 'ex/music' } })
    expect(modDataPath('music-mod')).toBe(join(paths.getDataPath(), 'ex-music'))
    expect(modDataPath('music-mod', PLAYTHROUGH)).toBe(join(paths.getPlaythroughPath(PLAYTHROUGH), 'ex', 'music'))
  })

  it('refuses a bad mod id, a bad playthrough id and a playthrough that is not there', () => {
    expect(() => modDataPath('../saves')).toThrow(expect.objectContaining({ code: 'MOD_ID_INVALID' }))
    expect(() => modDataPath('main')).toThrow(expect.objectContaining({ code: 'MOD_ID_INVALID' }))
    expect(() => modDataPath('music-mod', '../x')).toThrow(expect.objectContaining({ code: 'PLAYTHROUGH_ID_INVALID' }))
    expect(() => modDataPath('music-mod', '1800000000000')).toThrow(
      expect.objectContaining({ code: 'MOD_DATA_NO_PLAYTHROUGH' })
    )
  })
})

describe('a manifest dataPath', () => {
  it.each([
    ['an absolute path', { data: '/etc' }],
    ['a climb out', { data: 'ex/../../x' }],
    ['three folders', { data: 'a/b/c' }],
    ['a capital', { data: 'ExMusic' }],
    ['one of the game’s folders under data', { data: 'saves/music' }],
    ['one of the game’s files under a playthrough', { playthrough: 'playthrough.json' }],
    ['a save file under a playthrough', { playthrough: 'autosave.json' }],
    ['an unknown field', { music: 'x' }]
  ])('refuses %s', (_what, dataPath) => {
    const parsed = parseManifest(manifestJson({ dataPath }))
    expect(parsed.ok).toBe(false)
  })

  it('keeps a declared folder as written', () => {
    const parsed = parseManifest(manifestJson({ dataPath: { data: 'ex-music' } }))
    expect(parsed.ok && parsed.manifest.dataPath).toEqual({ data: 'ex-music' })
  })

  it('refuses every name the game itself keeps under data and under a playthrough', () => {
    const data = [
      paths.getSavesPath(),
      paths.getModsDirPath(),
      paths.getModsPath(),
      paths.getModDataRootPath(),
      paths.getCharactersPath(),
      paths.getSettingsPath(),
      paths.getGrabBagsPath(),
      paths.getAppLogPath(),
      paths.getBackgroundsPath(),
      paths.getScenesPath(),
      paths.getTempPath(),
      paths.getUpdatePath()
    ].map((path) => basename(path))
    expect(CORE_DATA_NAMES).toEqual(expect.arrayContaining(data))
    const playthrough = [
      paths.getPlaythroughRecordPath(PLAYTHROUGH),
      paths.getEnrollmentPath(PLAYTHROUGH),
      paths.getEndingArtPath(PLAYTHROUGH),
      paths.getProfilePicturePath(PLAYTHROUGH),
      paths.getLorebookPath(PLAYTHROUGH),
      paths.getPhotosPath(PLAYTHROUGH),
      paths.getReplaysPath(PLAYTHROUGH)
    ].map((path) => basename(path))
    expect(CORE_PLAYTHROUGH_NAMES).toEqual(expect.arrayContaining(playthrough))
    for (const name of data) expect(parseManifest(manifestJson({ dataPath: { data: name } })).ok).toBe(false)
  })
})
