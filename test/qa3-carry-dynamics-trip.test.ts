import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHARACTER_DYNAMICS_MOD, type CharacterDynamics } from '@shared/characterDynamics'
import { CITY_LIFE_JOBS_MOD, CITY_LIFE_LOCATIONS_MOD, cityLifeJobsOn, cityLifeLocationsOn } from '@shared/cityLife'
import { stampSave } from '@shared/saveRules'
import type { StructuredRequest } from '@shared/types'
import { character, charInfo, charactersById, playthroughRecord, restoreApi, stubApi } from './fixtures'
import { useAssetStore } from '../src/renderer/stores/assetStore'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState, type TripRun } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/character-dynamics'

const capture = vi.hoisted(() => ({ requests: [] as StructuredRequest[] }))
vi.mock('../src/renderer/stores/loop/stream', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/stream')>(),
  streamScene: vi.fn((request: StructuredRequest) => {
    capture.requests.push(request)
    return new Promise(() => {})
  })
}))
vi.mock('../src/renderer/stores/loop/turn', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/turn')>(),
  runSceneTurn: vi.fn(async () => {})
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { enterTrip, startFarewellScene } = await import('../src/renderer/stores/gameLoop')

const reason = 'They used to compete in the same local chess club and are still friendly rivals.'
const dynamics: CharacterDynamics = { version: 1, characters: {
  alice: { traits: ['meticulous'], relationship: { kind: 'rival', reason } }
} }
const trip: TripRun = {
  charId: 'alice', action: 'The reader visits Alice at her hometown during the summer break.',
  now: ['A summer visit, far from the university.'], day: 150, half: 'day',
  stamp: { week: 4, figure: '4', weekday: 'Saturday' },
  judge: async () => [], lines: null, done: () => {}
}

beforeEach(() => {
  capture.requests.length = 0
  useGameStore.getState().reset()
  resetLoopState()
  useAssetStore.setState({ backgrounds: { interior: ['bowling_alley', 'classroom', 'hotel_room'], exterior: [] } })
  stubApi({
    jobs: { onProgress: () => () => {}, cancelGroup: async () => ({ ok: true, data: undefined }) },
    chars: {
      cgs: async () => ({ ok: true, data: {} as never }),
      outfits: async () => ({ ok: true, data: {} as never }),
      room: async () => ({ ok: true, data: {} as never })
    }
  })
})
afterEach(() => { resetLoopState(); restoreApi(); vi.restoreAllMocks(); useAssetStore.setState({ backgrounds: { interior: [], exterior: [] } }) })

describe('QA3: break visits keep the source semester’s Character Dynamics switch', () => {
  it.each([
    { recorded: true, menu: true, label: 'control: on in both the record and menu' },
    { recorded: true, menu: false, label: 'record on, menu disabled for future playthroughs' },
    { recorded: false, menu: false, label: 'control: off in both the record and menu' },
    { recorded: false, menu: true, label: 'record off, menu enabled for future playthroughs' }
  ])('$label', async ({ recorded, menu }) => {
    useModsStore.setState({ switches: { on: { [CHARACTER_DYNAMICS_MOD]: menu, [CITY_LIFE_LOCATIONS_MOD]: menu, [CITY_LIFE_JOBS_MOD]: menu, echo: false, reckoning: false }, options: {} } })
    const alice = character({ charId: 'alice', firstName: 'Alice' })
    const record = playthroughRecord({ chars: ['alice'], mods: recorded ? [CHARACTER_DYNAMICS_MOD, CITY_LIFE_LOCATIONS_MOD, CITY_LIFE_JOBS_MOD] : [] })
    const save = stampSave({
      ...useGameStore.getState().toGameSave(), date: 122, time: 0, graduationSeen: true,
      charInfo: { alice: charInfo({ nameKnown: true, flags: { ...charInfo().flags, hasMet: true, gaveContactInfo: true } }) },
      exCharacterDynamics: dynamics
    }, 'source-semester', 'autosave', 1)
    // Ordinary source-semester scenes obey the immutable record even when the menu differs.
    useGameStore.getState().loadSave(save, record, charactersById(alice))
    loopState.record = record
    await startFarewellScene('alice')
    expect(capture.requests.at(-1)!.user.includes(reason)).toBe(recorded)
    expect(JSON.stringify(capture.requests.at(-1)!.schema).includes('bowling_alley')).toBe(recorded)
    capture.requests.length = 0

    // This is the production entry point used by BreakView for a booked visit.
    enterTrip(save, record, charactersById(alice), trip)
    await vi.waitFor(() => expect(capture.requests).toHaveLength(1))
    expect(useGameStore.getState().exCharacterDynamics).toEqual(dynamics)
    expect(useGameStore.getState().playthroughMods).toEqual(record.mods)
    // Changing a future-playthrough switch must not change the old semester’s saved history.
    expect.soft(capture.requests[0].user.includes(reason)).toBe(recorded)
    expect.soft(cityLifeLocationsOn()).toBe(recorded)
    expect.soft(cityLifeJobsOn()).toBe(recorded)
    expect.soft(JSON.stringify(capture.requests[0].schema).includes('bowling_alley')).toBe(recorded)
    // The break-specific campus exclusion remains independent and must keep working.
    expect(JSON.stringify(capture.requests[0].schema)).not.toContain('classroom')
  })
})
