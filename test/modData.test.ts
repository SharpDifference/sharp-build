import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import type { GameSave, ModSlice, SocialPost } from '@shared/types'
import { enrollment, playthroughRecord, stubApi } from './fixtures'

/**
 * `ex`, the mods' own data in a save: each registered mod's slice read through its `normalize`
 * on every load, on or off, and written back under its version; every other slice, and a slice
 * its mod could not read, written back exactly as read; and the slices carried into the next
 * semester's first save by each mod's `carry`.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The window's kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const host = await import('@vx/modkit/host/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useModSessionStore } = await import('../src/renderer/stores/modSessionStore')
const { modSlicesLeaving } = await import('../src/renderer/stores/semesterModCarry')
const { carryOf } = await import('../src/renderer/stores/semesterCarry')
const { continuedStartOf } = await import('../src/renderer/stores/semesterStart')
const { semesterOf } = await import('@shared/semesters')

const RECORD = playthroughRecord()

function def(id: string, version: string): ModDef {
  return { id, name: id, author: 'test', version, scope: 'anytime', defaultOn: true, blurb: '' }
}

beforeAll(() => installMods([def('notes-mod', '2.1.0'), def('carry-mod', '3.0.0')]))

afterEach(() => {
  host.setHookRules({ isOn: () => true, order: () => 0 })
  host.setDeclaredHooks(null)
  host.setLoadingMod(null)
  vi.restoreAllMocks()
})

/** A save as a fresh store writes it, with `extra` on top. */
function saveWith(extra: Record<string, unknown>): GameSave {
  useGameStore.getState().reset()
  return {
    ...useGameStore.getState().toGameSave(),
    playthroughId: 'p1',
    saveId: 'manual01',
    saveDate: 0,
    ...extra
  } as GameSave
}

/** `save` loaded and written again by the store. */
function roundTrip(save: GameSave): ReturnType<ReturnType<typeof useGameStore.getState>['toGameSave']> {
  useGameStore.getState().loadSave(structuredClone(save), RECORD, {})
  return structuredClone(useGameStore.getState().toGameSave())
}

describe('a save field on load and save', () => {
  it("reads a registered mod's slice and legacy key through normalize, on or off, and writes its value under its version", () => {
    const normalize = vi.fn((stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => ({
      notes: [...((stored as { notes: string[] } | undefined)?.notes ?? []), ...((legacy.oldNotes as string[]) ?? [])],
      from
    }))
    const field = kit.saveField('notes-mod', { empty: { notes: [] as string[], from: null as string | null }, legacy: ['oldNotes'], normalize })
    expect(host.saveFields().get('notes-mod')).toBeDefined()
    host.setHookRules({ isOn: (id) => id !== 'notes-mod', order: () => 0 })

    const out = roundTrip(saveWith({ ex: { 'notes-mod': { v: '1.0.0', data: { notes: ['a'] } } }, oldNotes: ['b'] }))

    expect(normalize).toHaveBeenCalledWith({ notes: ['a'] }, { oldNotes: ['b'] }, '1.0.0')
    expect(field.read()).toEqual({ notes: ['a', 'b'], from: '1.0.0' })
    expect(out.ex).toEqual({ 'notes-mod': { v: '2.1.0', data: { notes: ['a', 'b'], from: '1.0.0' } } })
    expect(out).not.toHaveProperty('oldNotes')
  })

  it('runs nothing and writes no ex for a mod the save holds nothing for', () => {
    const normalize = vi.fn(() => 1)
    const field = kit.saveField('quiet-mod', { empty: 0, legacy: ['quietOld'], normalize })
    const out = roundTrip(saveWith({}))
    expect(normalize).not.toHaveBeenCalled()
    expect(field.read()).toBe(0)
    expect(out).not.toHaveProperty('ex')
  })

  it('keeps the data of a mod whose normalize throws exactly as read, and says so on its row', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const field = kit.saveField('broken-mod', {
      empty: 'empty',
      legacy: ['brokenOld'],
      normalize: () => {
        throw new Error('bad shape')
      }
    })
    const slice = { v: '0.9.0', data: { deep: { n: [1, 2] } } }
    const out = roundTrip(saveWith({ ex: { 'broken-mod': slice }, brokenOld: { k: 1 } }))

    expect(error).toHaveBeenCalledWith('[mods] broken-mod: its save data could not be read', expect.any(Error))
    expect(out.ex).toEqual({ 'broken-mod': slice })
    expect((out as Record<string, unknown>).brokenOld).toEqual({ k: 1 })
    expect(field.read()).toBe('empty')
    expect(useModSessionStore.getState().dataNotes['broken-mod']).toBe(
      'its save data in this game could not be read; it is kept as it was'
    )
    // The note is the game's: leaving it takes the note away.
    useGameStore.getState().reset()
    expect(useModSessionStore.getState().dataNotes).toEqual({})
  })

  it("writes an unregistered mod's data back untouched, and a set value under the mod's version", () => {
    const field = kit.saveField('set-mod', { empty: { count: 0 } })
    const stranger = { v: '5.0.0', data: { deep: { list: [1, { x: 'y' }] } } }
    const save = saveWith({ ex: { 'gone-mod': stranger }, goneOld: [1, 2] })
    useGameStore.getState().loadSave(structuredClone(save), RECORD, {})

    const next = { count: 4 }
    field.set(next)
    expect(field.read()).toBe(next)
    // A change after the save is taken does not reach the written save.
    const out = structuredClone(useGameStore.getState().toGameSave())
    next.count = 99

    expect(out.ex).toEqual({ 'gone-mod': stranger, 'set-mod': { v: '0.0.0', data: { count: 4 } } })
    expect((out as Record<string, unknown>).goneOld).toEqual([1, 2])
    expect(roundTrip({ ...save, ...out } as GameSave).ex?.['gone-mod']).toEqual(stranger)
  })
})

describe('registering a save field', () => {
  it('refuses a second field for one id, and one for another id during an installed mod’s import', () => {
    const refused: [string, string][] = []
    host.setDeclaredHooks({
      declared: (id) => (id === 'installed-mod' ? [] : undefined),
      onRefused: (id, message) => refused.push([id, message])
    })
    kit.saveField('installed-mod', { empty: 1 })
    expect(kit.saveField('installed-mod', { empty: 2 }).read()).toBe(2)

    host.setLoadingMod('installed-mod')
    const foreign = kit.saveField('victim-mod', { empty: 'v' })
    const record = kit.recordField('victim-mod', { empty: 'v' })
    host.setLoadingMod(null)

    expect(refused).toEqual([
      ['installed-mod', 'registered a second save field for `installed-mod`'],
      ['installed-mod', 'registered a save field for `victim-mod`, which is another mod'],
      ['installed-mod', 'registered a record field for `victim-mod`, which is another mod']
    ])
    expect(host.saveFields().has('victim-mod')).toBe(false)
    expect(foreign.read()).toBe('v')
    const post = { ex: { 'victim-mod': { v: '1.0.0', data: 'theirs' } } }
    expect(record.read(post)).toBe('v')
    expect(record.with(post, 'mine')).toBe(post)

    // An in-repo mod's second field is a bug in the build.
    kit.saveField('in-repo-mod', { empty: 0 })
    expect(() => kit.saveField('in-repo-mod', { empty: 0 })).toThrow('second save field')
  })
})

describe('a record field', () => {
  const field = kit.recordField('notes-mod', {
    empty: [] as string[],
    legacy: ['tags'],
    normalize: (stored, legacy) => (stored as string[] | undefined) ?? (legacy.tags as string[]) ?? []
  })
  const post: SocialPost & { tags?: string[] } = { id: 'p', text: 'hi', date: 1, time: 0, likes: 0, tags: ['old'] }

  it('reads from its slice or its legacy key, and writes a new record without the legacy key', () => {
    expect(field.read(post)).toEqual(['old'])
    expect(field.read({ ex: { 'notes-mod': { v: '1.0.0', data: ['new'] } } })).toEqual(['new'])
    expect(field.read({})).toEqual([])

    const before = structuredClone(post)
    const next = ['a']
    const written = field.with(post, next)
    next.push('b')
    expect(written).toEqual({ id: 'p', text: 'hi', date: 1, time: 0, likes: 0, ex: { 'notes-mod': { v: '2.1.0', data: ['a'] } } })
    expect(post).toEqual(before)
    // What it reads is its own copy, so changing it changes no record.
    field.read(written).push('c')
    expect(field.read(written)).toEqual(['a'])
  })
})

describe('the carry into the next semester', () => {
  it("carries each slice by its mod's carry, starts one with none empty, and an unregistered one as read", () => {
    kit.saveField('carry-mod', {
      empty: { days: [] as number[] },
      normalize: (stored) => stored as { days: number[] },
      carry: (value, context) => ({ days: value.days.map((day) => day - context.back) })
    })
    kit.saveField('term-mod', { empty: 0, normalize: (stored) => stored as number })
    const stranger = { v: '1.0.0', data: { keep: true } }
    const save = saveWith({
      ex: {
        'carry-mod': { v: '3.0.0', data: { days: [120, 130] } },
        'term-mod': { v: '1.0.0', data: 7 },
        'gone-mod': stranger
      }
    })
    useGameStore.getState().loadSave(structuredClone(save), RECORD, {})
    const game = useGameStore.getState()
    const view = semesterOf(RECORD, undefined)
    const handoff = carryOf(game, view)
    const ex = modSlicesLeaving(game.modData, game.modValues, {
      playthroughId: 'p1',
      index: 0,
      season: view.season,
      characters: {}
    }) as Record<string, ModSlice>
    const back = 120 - (ex['carry-mod'].data as { days: number[] }).days[0]
    expect(back).toBeGreaterThan(0)
    expect(ex).toEqual({ 'carry-mod': { v: '3.0.0', data: { days: [120 - back, 130 - back] } }, 'gone-mod': stranger })

    handoff.carry.ex = ex
    const next = continuedStartOf(
      enrollment({
        continued: {
          id: '300',
          index: 1,
          alumni: handoff.alumni,
          priorProfiles: handoff.priorProfiles,
          pursuits: {},
          carry: handoff.carry
        }
      }),
      {},
      []
    )
    expect(next.save.ex).toEqual(ex)
    expect(next.save).not.toHaveProperty('carry-mod')
  })
})
