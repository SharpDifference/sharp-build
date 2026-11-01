import { describe, expect, it } from 'vitest'
import { rollProfessor } from '@shared/academics'
import {
  emptyCatalog,
  type ApplicationContinuation,
  type ApplicationDraft,
  type FinalEdits,
  type StartResult
} from '@shared/application'
import { locationLabel } from '@shared/locations'
import type { ClassEntry } from '@shared/types'
import {
  finalFaultsOf,
  finalizedOf,
  withFinalOccasion
} from '../src/renderer/stores/applicationFinalize'

/**
 * The semester Finalize hands the registrar: a change that cannot be kept leaves the composed
 * value, and one that can reaches everywhere the composed value stood, so a new code never strands
 * a seat and a renamed major never leaves a girl apart from her classes.
 */

const professor = rollProfessor(['Lin'], () => 0)

/** A course of `major`, met in `slot`. */
function course(code: string, slot: ClassEntry['slot'], major?: string): ClassEntry {
  return {
    code,
    name: code,
    description: `${code}.`,
    category: major ? 'major' : 'arts',
    ...(major ? { major } : {}),
    kind: 'lecture',
    difficulty: 'medium',
    professor,
    slot
  }
}

/** The semester as Loading composed it: Sarah in Biology, Mia in Chemistry. */
function composed(): StartResult {
  return {
    schedules: {
      classes: {
        'BIO 210': course('BIO 210', 0, 'Biology'),
        'BIO 220': course('BIO 220', 1, 'Biology'),
        'CHEM 101': course('CHEM 101', 3, 'Chemistry'),
        'ART 101': course('ART 101', 2),
        'PE 101': { code: 'PE 101', name: 'Yoga', description: 'Yoga.', category: 'pe', instructor: professor, slot: 4 }
      },
      perChar: {
        sarah: { year: 2, dorm: 'lowrise_1', major: 'Biology', schedule: { 0: 'BIO 210', 1: 'BIO 220', 4: 'PE 101' } },
        mia: { year: 3, dorm: 'lowrise_2', major: 'Chemistry', schedule: { 0: 'BIO 210', 3: 'CHEM 101', 2: 'ART 101' } }
      }
    },
    jobs: { sarah: { jobId: 'fast_eats', count: 2 } },
    haunts: {
      sarah: {
        homeSlots: 2,
        study: null,
        fun: [],
        activity: { location: 'whitman_greenhouse', doing: 'sketching at the Whitman Greenhouse' },
        meal: null
      }
    },
    feeds: {
      sarah: { handle: 'sarahrose', winterPosts: ['Snow again.'] },
      mia: { handle: 'miapark', winterPosts: [] }
    },
    springBreakPlans: { sarah: 'Go home.' },
    occasions: [
      {
        id: 'gala',
        title: 'Winter Gala',
        description: 'Formal.',
        startDate: 20,
        endDate: 20,
        time: 1,
        cancelsClasses: false,
        kind: 'campus'
      }
    ],
    fixedEdits: {},
    secrets: { sarah: [{ text: 'Sarah sings.', tier: 'friendly' }] },
    starts: {},
    pairs: {}
  }
}

/** An application on Finalize holding `edits`, Mia returning from a last semester under `continued`. */
function onFinalize(edits?: FinalEdits, continued?: Partial<ApplicationContinuation>): ApplicationDraft {
  return {
    screen: 'finalize',
    season: 'spring',
    chars: ['sarah', 'mia'],
    plan: [],
    occasions: {},
    catalog: emptyCatalog(),
    girls: {},
    pairs: {},
    replies: {},
    composed: composed(),
    ...(edits ? { finalEdits: edits } : {}),
    ...(continued ? { continued: continued as ApplicationContinuation } : {})
  }
}

describe('finalizedOf', () => {
  it('gives back the semester as composed where nothing is changed or a box is only cleared', () => {
    expect(finalizedOf(onFinalize())).toEqual(composed())
    const cleared = withFinalOccasion(onFinalize(), 'gala', { title: '' })
    expect(cleared.finalEdits).toEqual({ occasions: { gala: { title: '' } } })
    expect(finalFaultsOf(cleared)).toEqual([])
    expect(finalizedOf(cleared)).toEqual(composed())
  })

  it('reseats every timetable on a new code, and keeps one another class or semester has', () => {
    const recoded = finalizedOf(onFinalize({ classes: { 'BIO 210': { code: ' BIO 310 ' } } }))
    expect(Object.keys(recoded.schedules.classes).sort()).toEqual(['ART 101', 'BIO 220', 'BIO 310', 'CHEM 101', 'PE 101'])
    expect(recoded.schedules.classes['BIO 310'].code).toBe('BIO 310')
    expect(recoded.schedules.perChar.sarah.schedule[0]).toBe('BIO 310')
    expect(recoded.schedules.perChar.mia.schedule[0]).toBe('BIO 310')

    const clash = onFinalize(
      { classes: { 'ART 101': { code: 'BIO 220' }, 'PE 101': { code: 'HIST 100' } } },
      { continuing: [], taken: [{ code: 'HIST 100', name: 'History' }] }
    )
    expect(finalFaultsOf(clash)).toEqual([
      { kind: 'code', code: 'ART 101', why: 'repeated' },
      { kind: 'code', code: 'PE 101', why: 'taken' }
    ])
    expect(finalizedOf(clash).schedules).toEqual(composed().schedules)
  })

  it('renames a major for every girl taking it and its classes, never onto another or a returning girl’s', () => {
    const renamed = finalizedOf(onFinalize({ majors: { Biology: '  Marine   Biology ' } }))
    expect(renamed.schedules.perChar.sarah.major).toBe('Marine Biology')
    expect(renamed.schedules.classes['BIO 210'].major).toBe('Marine Biology')
    expect(renamed.schedules.classes['BIO 220'].major).toBe('Marine Biology')
    expect(renamed.schedules.perChar.mia.major).toBe('Chemistry')

    const onto = onFinalize({ majors: { Biology: 'chemistry' } })
    expect(finalFaultsOf(onto)).toEqual([{ kind: 'major', major: 'Biology' }])
    expect(finalizedOf(onto).schedules).toEqual(composed().schedules)

    const hers = onFinalize({ majors: { Chemistry: 'Physics' } }, { continuing: ['mia'], taken: [] })
    expect(finalFaultsOf(hers)).toEqual([])
    expect(finalizedOf(hers).schedules.perChar.mia.major).toBe('Chemistry')
  })

  it('keeps a girl’s pairs only whole and repairs her words as a reply’s are', () => {
    const half = onFinalize({
      girls: {
        sarah: { job: { jobId: 'kendall_library' }, activity: { location: 'green_hill_park' }, handle: '@@!!' }
      }
    })
    expect(finalFaultsOf(half)).toEqual([
      { kind: 'handle', charId: 'sarah' },
      { kind: 'job', charId: 'sarah' },
      { kind: 'activity', charId: 'sarah' }
    ])
    const kept = finalizedOf(half)
    expect(kept.jobs).toEqual(composed().jobs)
    expect(kept.haunts).toEqual(composed().haunts)
    expect(kept.feeds).toEqual(composed().feeds)

    const whole = finalizedOf(
      onFinalize({
        girls: {
          sarah: {
            job: null,
            dorm: 'elysium',
            activity: { location: 'green_hill_park', doing: 'Painting.' },
            handle: '@Sarah.Rose',
            posts: { '0': ' Home at last. ' },
            secrets: { friendly: ' Sarah hums ' }
          },
          // A returning girl's choices stay hers; only her words are Finalize's.
          mia: { dorm: 'elysium', posts: { '0': 'None.' } }
        }
      }, { continuing: ['mia'], taken: [] })
    )
    expect(whole.jobs).toEqual({})
    // Elysium is a junior's or a senior's, and Sarah is a sophomore.
    expect(whole.schedules.perChar.sarah.dorm).toBe('lowrise_1')
    expect(whole.schedules.perChar.mia.dorm).toBe('lowrise_2')
    expect(whole.haunts.sarah.activity).toEqual({
      location: 'green_hill_park',
      doing: `painting at ${locationLabel('green_hill_park')}`
    })
    expect(whole.feeds.sarah).toEqual({ handle: 'sarah.rose', winterPosts: ['Home at last.'] })
    expect(whole.feeds.mia).toEqual(composed().feeds.mia)
    expect(whole.secrets.sarah).toEqual([{ text: 'Sarah hums.', tier: 'friendly' }])
  })
})
