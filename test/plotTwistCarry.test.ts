import { afterEach, expect, it } from 'vitest'
import { NO_SWITCHES } from '@shared/mods'
import { activePlotTwist, PLOT_TWIST_MOD } from '@shared/plotTwists'
import { carriedModFields } from '@shared/modCarry'
import { modFieldsLeaving } from '../src/renderer/stores/semesterModCarry'
import type { GameSave } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { modIsOn, useModsStore } from '../src/renderer/stores/modsStore'

// @shared/mods loads the actual entry files, including the retention adapter.
afterEach(() => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: NO_SWITCHES })
})

it.each([true, false])('retains the twist through New Game+ with its switch %s', (enabled) => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: enabled }, options: {} } })
  const draft = useGameStore.getState().toGameSave()
  const twist = 'A character knows why the observatory closed.'
  const save: GameSave = {
    ...draft, playthroughId: '123', saveId: 'end', saveDate: 0, exPlotTwist: twist
  }
  const mods = modFieldsLeaving(save, { playthroughId: '123', index: 0, season: 'spring', characters: {} })
  const opening = { ...draft, ...carriedModFields(JSON.parse(JSON.stringify(mods))) }
  expect(opening.exPlotTwist).toBe(twist)
  expect(activePlotTwist(opening.exPlotTwist, modIsOn(PLOT_TWIST_MOD))).toBe(enabled ? twist : '')
  expect(save.exPlotTwist).toBe(twist)
  expect(draft.exPlotTwist ?? '').toBe('')

  // Another fresh start has no connection to the archived continuation.
  useGameStore.getState().reset()
  expect(useGameStore.getState().toGameSave().exPlotTwist ?? '').toBe('')
})

it.each([undefined, ''])('keeps a missing or explicitly cleared twist blank (%s)', (twist) => {
  useGameStore.getState().reset()
  const draft = useGameStore.getState().toGameSave()
  const save: GameSave = {
    ...draft, playthroughId: '123', saveId: 'end', saveDate: 0, exPlotTwist: twist
  }
  const mods = modFieldsLeaving(save, { playthroughId: '123', index: 0, season: 'spring', characters: {} })
  const opening = { ...draft, ...carriedModFields(mods) }
  expect(opening.exPlotTwist ?? '').toBe('')
})
