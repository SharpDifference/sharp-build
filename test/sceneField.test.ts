import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { restoreApi, sceneLines, stubApi } from './fixtures'

/**
 * A mod's scene field: setting its own value leaves every other mod's as it was; a value kept
 * under its old key is read and moved to its id; and its save writes its keys alone into the
 * point a reload lands on, or is refused, changing nothing.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { writesSettled } = await import('../src/renderer/stores/loop/saves')
const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')

function def(id: string, extra: Partial<ModDef> = {}): ModDef {
  return { id, name: id, author: 'test', version: '1.0.0', scope: 'anytime', defaultOn: true, blurb: '', ...extra }
}

beforeAll(() => installMods([def('scene-saver'), def('scene-other'), def('scene-off', { defaultOn: false })]))

/** The autosave channel, recording each draft it was handed. */
function stubAutosave() {
  const autosave = vi.fn(async (_playthroughId: string, _draft: SaveDraft): Promise<Result<GameSave>> => ({
    ok: true,
    data: { saveId: 'auto' } as GameSave
  }))
  stubApi({ saves: { autosave } as never })
  return { autosave, draft: (call: number) => autosave.mock.calls[call]?.[1] as SaveDraft }
}

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  useGameStore.setState({ playthroughId: 'p1' })
})

afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('sceneField', () => {
  it("keeps the other mods' scene values, in the store and in the saved scene, when one mod sets its own", () => {
    const first = kit.sceneField('scene-field-first', { empty: 0 })
    const second = kit.sceneField('scene-field-second', { empty: { notes: [] as string[] } })
    useGameStore.setState({ sceneMods: {}, sceneLog: [{ speaker: 'x', text: 'hi' }] as never })

    first.set(4)
    second.set({ notes: ['kept'] })
    first.set(5)

    expect(first.read()).toBe(5)
    expect(second.read()).toEqual({ notes: ['kept'] })
    expect(useGameStore.getState().toGameSave().scene?.mods).toEqual({
      'scene-field-first': 5,
      'scene-field-second': { notes: ['kept'] }
    })
  })

  it('reads a value kept under its legacy key through normalize, and moves it to its id when set', () => {
    const normalize = vi.fn((stored: unknown) => ({ n: Number((stored as { n?: unknown }).n ?? 0) }))
    const field = kit.sceneField('legacy-mod', { empty: { n: 0 }, legacy: 'legacyMod', normalize })
    const broken = kit.sceneField('broken-mod', {
      empty: 'none',
      normalize: () => {
        throw new Error('unreadable')
      }
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useGameStore.setState({ sceneMods: { legacyMod: { n: '3' }, 'broken-mod': 'old', other: 1 } as never })

    expect(field.read()).toEqual({ n: 3 })
    expect(broken.read()).toBe('none')
    expect(broken.read()).toBe('none')
    expect(warn).toHaveBeenCalledTimes(1)

    field.set({ n: 4 })
    expect(field.read()).toEqual({ n: 4 })
    expect(normalize).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().sceneMods).toEqual({ 'broken-mod': 'old', other: 1, 'legacy-mod': { n: 4 } })
  })

  it("refuses a legacy key that could be a mod's id, or that another field claimed", () => {
    expect(() => kit.sceneField('named-mod', { empty: 0, legacy: 'other-mod' })).toThrow(/could be a mod's id/)
    kit.sceneField('first-claim', { empty: 0, legacy: 'sharedKey' })
    expect(() => kit.sceneField('second-claim', { empty: 0, legacy: 'sharedKey' })).toThrow(/first-claim/)
  })
})

describe('sceneField save', () => {
  const saver = kit.sceneField('scene-saver', { empty: 0, legacy: 'sceneSaver' })
  const other = kit.sceneField('scene-other', { empty: 0 })
  const off = kit.sceneField('scene-off', { empty: 0 })

  /** A scene under way, its decision point holding `mods`. */
  function sceneAt(mods: Record<string, unknown>): void {
    const lines = sceneLines('She deals the cards.')
    useGameStore.setState({ currentSceneTranscript: lines, sceneLog: lines, sceneMods: mods as never })
    loopState.decisionSave = useGameStore.getState().captureScene()
  }

  it("writes its own keys into the decision point, and no other mod's unsaved value", async () => {
    const { draft } = stubAutosave()
    sceneAt({ sceneSaver: 1, 'scene-other': 7 })
    other.set(8)

    expect(await saver.save(2)).toEqual({ ok: true, data: null })
    expect(loopState.decisionSave?.mods).toEqual({ 'scene-saver': 2, 'scene-other': 7 })
    expect(draft(0).scene?.mods).toEqual({ 'scene-saver': 2, 'scene-other': 7 })
    expect(useGameStore.getState().sceneMods).toEqual({ 'scene-saver': 2, 'scene-other': 8 })

    // Before the scene's first decision point, the scene is written as it stands.
    loopState.decisionSave = null
    expect(await saver.save(3)).toEqual({ ok: true, data: null })
    expect(draft(1).scene?.mods).toEqual({ 'scene-saver': 3, 'scene-other': 8 })
  })

  it.each([
    ['MOD_WRITE_NO_GAME', saver, () => useGameStore.setState({ playthroughId: null })],
    ['MOD_WRITE_OFF', off, () => {}],
    ['MOD_WRITE_NO_SCENE', saver, () => useGameStore.setState({ sceneEnding: true })],
    ['MOD_WRITE_NO_SCENE', saver, () => useGameStore.setState({ currentSceneTranscript: [] })]
  ] as const)('refuses with %s, changing nothing', async (code, field, arrange) => {
    const { autosave } = stubAutosave()
    sceneAt({})
    arrange()
    const before = loopState.decisionSave

    const result = await field.save(5)

    expect(result.ok ? null : result.error.code).toBe(code)
    expect(field.read()).toBe(0)
    expect(loopState.decisionSave).toBe(before)
    expect(autosave).not.toHaveBeenCalled()
  })
})
