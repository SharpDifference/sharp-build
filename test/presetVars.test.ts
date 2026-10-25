import { beforeEach, describe, expect, it } from 'vitest'
import '@shared/presets/presetVarsCarry'
import { carriedModFields, carryModFields } from '@shared/modCarry'
import { presetVarsWithin } from '@shared/presets/varOps'
import { SAVE_READ, stampSave } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { character, charactersById, playthroughRecord } from './fixtures'

beforeEach(() => useGameStore.getState().reset())

describe('Prompt Studio variables in a save', () => {
  it('round-trips through toGameSave and loadSave, drops non-string values, and stays absent when empty', () => {
    expect(useGameStore.getState().toGameSave()).not.toHaveProperty('presetVars')

    useGameStore.getState().setPresetVars({ mood: 'wary', trust: '3' })
    const save = stampSave(useGameStore.getState().toGameSave(), '123', '456', 1)
    expect(validateRecord(JSON.parse(JSON.stringify(save)), 'save.json', SAVE_READ).presetVars).toEqual({ mood: 'wary', trust: '3' })

    useGameStore.getState().reset()
    useGameStore.getState().loadSave(save, playthroughRecord(), {})
    expect(useGameStore.getState().presetVars).toEqual({ mood: 'wary', trust: '3' })

    const damaged = { ...save, presetVars: { ok: 'yes', n: 4, nested: { a: 1 } } } as unknown as typeof save
    useGameStore.getState().loadSave(damaged, playthroughRecord(), {})
    expect(useGameStore.getState().presetVars).toEqual({ ok: 'yes' })

    const { presetVars: _old, ...older } = save
    useGameStore.getState().loadSave(older, playthroughRecord(), {})
    expect(useGameStore.getState().presetVars).toEqual({})
  })

  it('carries into the next semester, and carries nothing when there are none', () => {
    useGameStore.getState().setPresetVars({ mood: 'wary' })
    const save = stampSave(useGameStore.getState().toGameSave(), '123', '456', 1)
    const context = { term: 0, back: 120, characters: charactersById(character({ charId: 'a' })) }
    expect(carriedModFields(carryModFields(save, context)).presetVars).toEqual({ mood: 'wary' })

    useGameStore.getState().setPresetVars({})
    const empty = stampSave(useGameStore.getState().toGameSave(), '123', '456', 1)
    expect(carryModFields(empty, context)).not.toHaveProperty('presetVars')
  })
})

describe('variables and a cut of the transcript', () => {
  const marks = [
    { at: 2, before: { n: '0' } },
    { at: 6, before: { n: '1' } },
    { at: 9, before: { n: '2' } }
  ]

  it('takes back the earliest reply that began at or past the cut and keeps a partly read one', () => {
    expect(presetVarsWithin(marks, 10)).toBeNull()
    expect(presetVarsWithin(marks, 9)).toEqual({ vars: { n: '2' }, marks: marks.slice(0, 2) })
    expect(presetVarsWithin(marks, 7)).toEqual({ vars: { n: '2' }, marks: marks.slice(0, 2) })
    expect(presetVarsWithin(marks, 6)).toEqual({ vars: { n: '1' }, marks: marks.slice(0, 1) })
    expect(presetVarsWithin(marks, 0)).toEqual({ vars: { n: '0' }, marks: [] })
  })

  it('is restored by truncateUnread and survives the scene capture', () => {
    const line = (text: string) => ({ speaker: 'a', text })
    const game = useGameStore.getState()
    // A reader line, a read reply of two lines, then a reply of two lines nobody has read.
    useGameStore.setState({
      currentSceneTranscript: [{ speaker: 'reader', text: 'hi' }, line('1'), line('2'), line('3'), line('4')],
      pendingLines: [line('3'), line('4')]
    })
    game.setPresetVars({ n: '0' })
    game.commitPresetVars({ n: '1' }, 1)
    game.commitPresetVars({ n: '2' }, 3)

    const scene = useGameStore.getState().captureScene()
    if (!scene) throw new Error('no scene captured')
    expect(scene.presetVarMarks).toEqual([{ at: 1, before: { n: '0' } }, { at: 3, before: { n: '1' } }])
    useGameStore.getState().restoreScene(scene)
    expect(useGameStore.getState().scenePresetVars).toHaveLength(2)

    useGameStore.getState().truncateUnread()
    expect(useGameStore.getState().presetVars).toEqual({ n: '1' })
    expect(useGameStore.getState().scenePresetVars).toEqual([{ at: 1, before: { n: '0' } }])

    useGameStore.getState().clearSceneTranscript()
    expect(useGameStore.getState().scenePresetVars).toEqual([])
  })
})
