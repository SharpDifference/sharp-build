import { describe, expect, it } from 'vitest'
import { stubApi } from './fixtures'

/** A mod's scene field: setting its own value leaves every other mod's in the scene, and in its save, as it was. */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')

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
})
