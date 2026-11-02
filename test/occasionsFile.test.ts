import { describe, expect, it } from 'vitest'
import { FINAL_DATE } from '@shared/classes'
import {
  MAX_FILE_OCCASIONS,
  OCCASIONS_FILE_FORMAT,
  occasionsFileOf,
  parseOccasionsFile,
  parseOccasionsFileText
} from '@shared/occasionsFile'
import { calendarOf } from '@shared/semesters'
import type { FixedOccasionEdits, Season } from '@shared/types'
import { breakWeekOf, keptFixedEdits } from '../src/renderer/prompts/occasions'
import {
  mintPlannedId,
  occasionKindOf,
  planOccasionSlots,
  planOfImport
} from '../src/renderer/prompts/occasionPrompt'

/**
 * An occasions file replaces a New Game's whole plan: an id minted differently from the planner's
 * would reach the occasion call and the save under a name nothing else reads, and an entry that
 * cannot sit on the calendar would be a semester nobody can play.
 */

const RUNS = 30

/** Inspiration words in a fixed order, so two plans drawn alike carry the same ones. */
const words = (count: number): string[] => Array.from({ length: count }, (_, i) => `word${i}`)

/** The code a refusal carries, or undefined where nothing was refused. */
function refusalOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (err) {
    return (err as { code?: string }).code
  }
  return undefined
}

/** A file in the right shape around `occasions`. */
function fileOf(occasions: unknown[], season: Season = 'spring'): unknown {
  return { format: OCCASIONS_FILE_FORMAT, schemaVersion: 1, season, occasions }
}

const GALA = { kind: 'gala', startDate: 3, endDate: 3, time: 0, title: 'Gala', description: 'On.' }

/** A change to one fixed occasion of each season, a move among them. */
const FIXED: Record<Season, FixedOccasionEdits> = {
  spring: { valentines: { title: 'Hearts Day', startDate: 33 } },
  fall: { halloween: { description: 'Costumes everywhere.', startDate: 68 } }
}

describe('an exported plan read back', () => {
  it('gives the planner’s plan and the fixed changes again, with the words under the same ids', () => {
    for (const season of ['spring', 'fall'] as const) {
      const fixed = keptFixedEdits(season, FIXED[season])
      expect(fixed).toEqual(FIXED[season])
      for (let run = 0; run < RUNS; run++) {
        const plan = planOccasionSlots(words, calendarOf(season, [], fixed))
        const occasions = {
          [plan[0].id]: { title: 'Ours', description: '' },
          [plan[plan.length - 1].id]: { title: 'Last', description: 'Ends it.' }
        }
        const file = occasionsFileOf({ season, plan, occasions }, occasionKindOf, fixed)
        const read = parseOccasionsFile(JSON.parse(JSON.stringify(file)))
        expect(read).toMatchObject({ season, leftOut: 0 })

        const back = planOfImport(read.entries, season, words)
        expect(back.plan).toEqual(plan)
        expect(back.occasions).toEqual(occasions)
        expect(Object.fromEntries(read.fixed.map(({ id, ...edit }) => [id, edit]))).toEqual(fixed)
      }
    }
  })
})

describe('a plan the player changed', () => {
  it('reads back a whole-day occasion and a fixed occasion taken off', () => {
    const entries = [
      { ...GALA, startDate: 40, endDate: 41, time: 1 },
      { ...GALA, kind: 'small-event', startDate: 60, endDate: 62, time: null }
    ]
    const { plan, occasions } = planOfImport(parseOccasionsFile(fileOf(entries)).entries, 'spring', words)
    expect(plan[1]).toMatchObject({ id: 'filler-8', startDate: 60, endDate: 62, time: null })
    const fixed = keptFixedEdits('spring', { easter: { removed: true, title: 'Egg Day' } })
    const file = occasionsFileOf({ season: 'spring', plan, occasions }, occasionKindOf, fixed)
    const read = parseOccasionsFile(JSON.parse(JSON.stringify(file)))
    expect(read.leftOut).toBe(0)
    expect(planOfImport(read.entries, 'spring', words).plan).toEqual(plan)
    expect(read.fixed).toEqual([{ id: 'easter', title: 'Egg Day', removed: true }])
  })

  it('never mints an id the plan already holds', () => {
    const taken = new Set(['gala', 'gala-2', 'filler-3', 'filler-break-0'])
    const offWeek = breakWeekOf('spring').startDate
    expect(mintPlannedId('gala', 40, 'spring', taken)).toBe('gala-3')
    expect(mintPlannedId('concert', 40, 'spring', taken)).toBe('concert')
    expect(mintPlannedId('small-event', 21, 'spring', taken)).toBe('filler-3-2')
    expect(mintPlannedId('small-event', offWeek, 'spring', taken)).toBe('filler-break-1')
  })
})

describe('parseOccasionsFile', () => {
  it('leaves out and counts what cannot sit on the calendar, and keeps any placement inside it', () => {
    const offWeek = breakWeekOf('spring')
    const read = parseOccasionsFile(
      fileOf([
        GALA,
        { ...GALA, title: 'Second gala' },
        { kind: 'small-event', startDate: 1, endDate: FINAL_DATE - 1, time: 1 },
        { ...GALA, kind: 'small-event', startDate: 5, endDate: 5 },
        { ...GALA, kind: 'small-event', startDate: offWeek.startDate, endDate: offWeek.startDate },
        'not an entry',
        null,
        { ...GALA, kind: 'party' },
        { ...GALA, startDate: 1.5 },
        { ...GALA, startDate: -1 },
        { ...GALA, startDate: 0, endDate: 0 },
        { ...GALA, endDate: FINAL_DATE },
        { ...GALA, startDate: 4, endDate: 3 },
        { ...GALA, time: 2 },
        { ...GALA, title: 7 }
      ])
    )
    expect(read.leftOut).toBe(10)
    expect(read.entries).toHaveLength(5)
    expect(read.entries[2]).toEqual({
      kind: 'small-event',
      startDate: 1,
      endDate: FINAL_DATE - 1,
      time: 1,
      title: '',
      description: ''
    })

    const { plan } = planOfImport(read.entries, 'spring', words)
    expect(plan.map((planned) => planned.id)).toEqual([
      'gala',
      'gala-2',
      'filler-0',
      'filler-0-2',
      'filler-break-0'
    ])
    expect(plan[4]).toMatchObject({ filler: true, breakWeek: true })
  })

  it('keeps the first well-formed change to each fixed occasion, and none from a file without them', () => {
    expect(parseOccasionsFile(fileOf([GALA])).fixed).toEqual([])
    const read = parseOccasionsFile({
      ...(fileOf([]) as object),
      fixed: [
        { id: 'valentines', title: 'Hearts Day', startDate: 33 },
        { id: 'valentines', title: 'Again' },
        { id: 'easter', startDate: 0 },
        { id: 'easter', description: 7 },
        { id: 'easter', removed: false },
        { title: 'No id' },
        'not a change'
      ]
    })
    expect(read.fixed).toEqual([{ id: 'valentines', title: 'Hearts Day', startDate: 33 }])
    expect(read.leftOut).toBe(6)
  })

  it('keeps no more than the cap and counts the rest as left out', () => {
    const many = Array.from({ length: MAX_FILE_OCCASIONS + 5 }, () => GALA)
    const read = parseOccasionsFile(fileOf(many))
    expect(read.entries).toHaveLength(MAX_FILE_OCCASIONS)
    expect(read.leftOut).toBe(5)
  })

  it('refuses anything that is not an occasions file', () => {
    const refusals = [
      null,
      [],
      { ...(fileOf([]) as object), format: 'something-else' },
      { ...(fileOf([]) as object), schemaVersion: 2 },
      { ...(fileOf([]) as object), season: 'winter' },
      { ...(fileOf([]) as object), occasions: {} },
      { ...(fileOf([]) as object), fixed: {} }
    ].map((parsed) => refusalOf(() => parseOccasionsFile(parsed)))
    expect(refusals).toEqual(Array(7).fill('OCCASIONS_IMPORT_INVALID'))
    expect(refusalOf(() => parseOccasionsFileText('not json'))).toBe('OCCASIONS_IMPORT_INVALID')
    expect(parseOccasionsFileText(`﻿${JSON.stringify(fileOf([GALA], 'fall'))}`)).toMatchObject({
      season: 'fall',
      leftOut: 0
    })
  })
})
