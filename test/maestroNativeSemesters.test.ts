import { afterEach, expect, it } from 'vitest'
import { MODS } from '@shared/mods'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { prepareEchoSetup } from '@shared/echoSetup'
import { normalizeMeanwhile } from '@shared/meanwhile'
import { normalizeStoryMemory, storySnapshot } from '@shared/storyMemory'
import { normalizeWhisper, whisperTerm } from '@shared/venusWhisper'
import { calendarOf, semesterOf } from '@shared/semesters'
import { SAVE_READ, stampSave } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { carryOf } from '../src/renderer/stores/semesterCarry'
import { modFieldsLeaving } from '../src/renderer/stores/semesterModCarry'
import { continuedStartOf } from '../src/renderer/stores/semesterStart'
import { character, charInfo, enrollment, playthroughRecord } from './fixtures'

afterEach(() => { useGameStore.getState().reset(); useModsStore.setState({ switches: { on: {}, options: {} } }) })

it('keeps Maestro save data through native spring and fall boundaries with mods disabled', () => {
  const a = character({ charId: 'a' }), b = character({ charId: 'b', firstName: 'Mina' })
  const cast = { a, b }
  const mods = ['city-life-locations', 'city-life-jobs', 'character-dynamics']
  let record = playthroughRecord({ chars: ['a', 'b'], mods, profiles: {
    a: { year: 1, intake: 'spring', major: 'Biology', dorm: 'lowrise_1', schedule: {}, moodCycleOffset: 0 },
    b: { year: 4, intake: 'fall', major: 'Biology', dorm: 'lowrise_1', schedule: {}, moodCycleOffset: 0 }
  } })
  const game = () => useGameStore.getState()
  game().reset()
  const echo = prepareEchoSetup(undefined, '123', [a, b], 'Test Reader', '')
  echo.playerChangeUsed = true
  const dynamics = { version: 1 as const, characters: { a: { traits: ['guarded'], growth: {
    id: 'earned', name: 'Trust', description: 'Learned to ask for help.', reframes: ['guarded']
  } } } }
  const lines = Array.from({ length: 6 }, (_, i) => ({ speaker: i % 2 ? 'a' : 'b', text: `A private spectator line ${i}.` }))
  const whisper = normalizeWhisper({ version: 1, author: { id: 'b', name: 'Mina Rose', handle: 'mina', voice: 'Calm', known: true },
    discovery: { author: 'b', term: 0, day: 4, time: 0 }, issues: [{ id: 'whisper:0:9', term: 0, day: 9,
      title: 'An old issue', body: 'A public claim.', subjects: ['a'], comments: [], answered: [] }] })
  useGameStore.setState({ playthroughId: '123', playthroughMods: mods, chars: ['a', 'b'], characters: cast,
    charInfo: { a: charInfo({ ...record.profiles.a, nameKnown: true }), b: charInfo({ ...record.profiles.b, nameKnown: true }) },
    date: 123, time: 0, calendar: calendarOf('spring', []),
    exEcho: echo, exCharacterDynamics: dynamics, exPlotTwist: 'An ongoing story direction.',
    exBreakthrough: normalizeBreakthrough({ meters: { a: 65, b: 80 }, moments: { a: [{ id: 'moment', date: 9, time: 0, outcome: 'They reached an understanding.' }] } }),
    exStoryMemory: normalizeStoryMemory({ facts: [{ id: 'manual:promise', text: 'A remembered promise.', subject: 'a',
      category: 'promise', timeline: 'current', certainty: 'event', claimant: null, knownBy: ['reader', 'a'], public: false,
      date: 9, time: 0, evidence: '', source: 'Player-added fact', supersedes: [], manual: true }] }),
    history: { 9: { 0: 'Sarah and Mina discussed the library.' } },
    exNpcWatch: normalizeMeanwhile({ scenes: [{ id: 'encounter:old', date: 9, participants: ['a', 'b'],
      title: 'An encounter', where: 'Library', positive: true, ref: 'library', kind: 'hangout', lines }] }),
    exVenusWhisper: whisper })
  useModsStore.setState({ switches: { on: Object.fromEntries(MODS.map(mod => [mod.id, false])), options: {} } })
  let shifted = 9
  for (const index of [1, 2]) {
    const view = semesterOf(record, game().semesterId ?? undefined)
    const handoff = carryOf(game(), view)
    handoff.carry.mods = modFieldsLeaving(game().toGameSave(), { playthroughId: '123', index: view.index, season: view.season, characters: cast })
    shifted -= view.season === 'spring' ? 210 : 155
    const roster = handoff.continuing.map(id => cast[id as keyof typeof cast])
    const draft = enrollment({ chars: roster.map(c => c.charId), mods, perChar: Object.fromEntries(roster.map(c =>
      [c.charId, { year: 1, major: 'Biology', dorm: 'lowrise_1', schedule: {} }])),
      continued: { id: String(200 + index), index, ...(view.id ? { parent: view.id } : {}),
        alumni: handoff.alumni, priorProfiles: handoff.priorProfiles, pursuits: { b: 'Working elsewhere.' }, carry: handoff.carry } })
    const start = continuedStartOf(draft, {}, roster)
    record = { ...record, semesters: { ...record.semesters, [start.id]: start.semester } }
    const save = validateRecord(JSON.parse(JSON.stringify(stampSave(start.save, '123', start.id, index))), 'opening.json', SAVE_READ)
    game().loadSave(save, record, cast)
    expect(game().semesterIndex).toBe(index)
    expect(whisperTerm(game())).toBe(index)
    expect(game().alumni).toContain('b')
    expect(game().playthroughMods).toEqual(mods)
    expect(game().exPlotTwist).toBe('An ongoing story direction.')
    expect(game().exEcho).toEqual(echo)
    expect(game().exCharacterDynamics).toEqual(dynamics)
    expect(game().exBreakthrough.meters).toEqual({ a: 65, b: 80 })
    expect(game().exBreakthrough.moments.a[0]).toMatchObject({ date: shifted, origin: { term: 0, day: 9 } })
    expect(game().exReckoning.active).toBeNull()
    expect(game().exNpcWatch.scenes[0]).toMatchObject({ date: shifted, origin: { term: 0, day: 9 }, lines })
    expect(game().exVenusWhisper).toEqual(whisper)
    const facts = storySnapshot(game())!.records
    expect(facts.find(f => f.id === 'term:0:manual:promise')).toMatchObject({ date: shifted, origin: { term: 0, day: 9 } })
    expect(facts.filter(f => f.kind === 'encounter')).toHaveLength(1)
    expect(JSON.stringify(facts)).not.toContain('spectator line')
    useGameStore.setState({ date: 123, time: 0 })
  }
})
