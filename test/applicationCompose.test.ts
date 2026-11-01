import { describe, expect, it, vi } from 'vitest'
import {
  emptyCatalog,
  incompleteOf,
  type ApplicationContinuation,
  type ApplicationDraft,
  type NewGameCall,
  type PlannedOccasion
} from '@shared/application'
import type { CharProfile, SemesterCarry } from '@shared/types'
import {
  composeApplication,
  majorsOf,
  needOf,
  type CallRequest,
  type RequestWorld
} from '../src/renderer/stores/applicationCompose'
import {
  decidedProfileOf,
  validateProfileDraft,
  type ProfileGenReply
} from '../src/renderer/prompts/profilePrompt'
import { character, charInfo } from './fixtures'

/**
 * What New Game composes out of its banked replies and the player's own values, and when a
 * banked reply still answers its call: a value of the player's lost at the merge, or a reply
 * kept for a request it no longer answers, is a semester quietly unlike the one set up.
 */

const SARAH = character({ charId: 'sarah', firstName: 'Sarah', lastName: 'Rose' })
const MIA = character({ charId: 'mia', firstName: 'Mia', lastName: 'Park' })
const ROSTER = [SARAH, MIA]
const WORLD: RequestWorld = { setting: 'A campus.', book: [] }

const GALA: PlannedOccasion = { id: 'gala', startDate: 12, endDate: 13, time: 1, seed: 'lantern' }
const FILLER: PlannedOccasion = {
  id: 'filler-3',
  startDate: 22,
  endDate: 22,
  time: 0,
  filler: true,
  seed: 'kite'
}

/** An application with every screen passed and nothing written. */
function draftOf(over: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    screen: 'loading',
    season: 'spring',
    chars: ROSTER.map((c) => c.charId),
    plan: [GALA, FILLER],
    occasions: {},
    catalog: emptyCatalog(),
    girls: {},
    pairs: {},
    replies: {},
    ...over
  }
}

/** The request a call needs, which these drafts always leave it one. */
function requestOf(call: NewGameCall, draft: ApplicationDraft): CallRequest {
  const need = needOf(call, draft, ROSTER, WORLD)
  if (typeof need === 'string') throw new Error(`${call} needs ${need}`)
  return need
}

/** The occasion ids a draft's occasions call asks the model to write. */
function askedIds(draft: ApplicationDraft): string[] {
  const schema = requestOf('occasions', draft).request.schema.schema as unknown as {
    properties: { events: { required: string[] } }
  }
  return schema.properties.events.required
}

/** The draft with `reply` banked for `call` against the request it needs now. */
function banked(call: NewGameCall, draft: ApplicationDraft, reply: unknown): ApplicationDraft {
  const need = requestOf(call, draft)
  need.check(reply)
  return {
    ...draft,
    replies: { ...draft.replies, [call]: { key: need.key, reply } }
  }
}

/** A whole profile row as the model writes one. */
function profileRow(key: string, major: string): Record<string, unknown> {
  return {
    key,
    year: 2,
    major,
    classesTaken: 4,
    majorClassesTaken: 2,
    dorm: 'lowrise_2',
    job: '',
    jobShifts: 0,
    homeSlots: 2,
    study: '',
    fun: [],
    activity: '',
    activityLocation: '',
    meal: '',
    handle: key,
    winterPosts: ['home'],
    springBreakPlans: 'Go home.'
  }
}

describe('composeApplication', () => {
  it("lays the player's values over every reply and seats every girl", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let draft = draftOf({
      occasions: { gala: { title: 'The Lantern Ball', description: 'In the Quad.' } },
      catalog: {
        ...emptyCatalog(),
        major: {
          Biology: [{ code: 'BIO 210', title: 'Cells', description: 'Cells.', kind: 'lecture' }]
        }
      },
      girls: {
        sarah: {
          profile: { major: 'Biology', majorClassesTaken: 1, year: 3 },
          secrets: { friendly: 'Sarah knits' },
          memories: []
        }
      }
    })

    // The gala is the player's, so only the filler is asked for.
    expect(askedIds(draft)).toEqual([FILLER.id])
    draft = banked('occasions', draft, {
      events: { 'filler-3': { title: 'Kite Day', description: 'Kites on the Quad.' } }
    })
    draft = banked('profiles', draft, {
      characters: [profileRow('sarah_rose', 'Physics'), profileRow('mia_park', 'Chemistry')]
    })
    draft = banked('secrets', draft, {
      trusted_devoted: [{ key: 'sarah_rose', trusted: 'Sarah lied.', devoted: 'Sarah left.' }],
      characters: [
        { key: 'mia_park', friendly: 'Mia sings.', trusted: 'Mia cried.', devoted: 'Mia ran.' }
      ]
    })
    // Biology is the player's in full but for three, so the reply writes those and Chemistry.
    draft = banked('classes', draft, {
      characters: {
        sarah_rose: { interestClass: { code: 'ART 101', name: 'Pots', description: 'Pots.', kind: 'project' } },
        mia_park: { interestClass: { code: 'MUS 101', name: 'Choir', description: 'Song.', kind: 'lecture' } }
      },
      classes: [
        { code: 'BIO 210', name: 'Genes', description: 'Genes.', category: 'major', major: 'Biology', kind: 'lecture' },
        { code: 'CHM 101', name: 'Atoms', description: 'Atoms.', category: 'major', major: 'Chemistry', kind: 'lecture' },
        { code: 'PE 101', name: 'Running', description: 'Running.', category: 'pe', kind: 'lecture' },
        { code: 'HIS 101', name: 'Rome', description: 'Rome.', category: 'humanities', kind: 'lecture' }
      ]
    })

    const semester = composeApplication(draft, ROSTER, WORLD)

    expect(semester.occasions.map((o) => o.title)).toEqual(['The Lantern Ball', 'Kite Day'])
    expect(semester.schedules.perChar.sarah).toMatchObject({ year: 3, major: 'Biology' })
    expect(semester.schedules.perChar.mia.major).toBe('Chemistry')
    // One Biology class, the player's load; the player's kept its code over the reply's repeat.
    const sarahs = Object.values(semester.schedules.perChar.sarah.schedule)
    const majorClasses = sarahs.filter(
      (code) => semester.schedules.classes[code]?.category === 'major'
    )
    expect(majorClasses).toHaveLength(1)
    const named = { 'BIO 210': 'Cells', 'BIO 211': 'Genes' } as Record<string, string>
    expect(semester.schedules.classes[majorClasses[0]].name).toBe(named[majorClasses[0]])
    expect(semester.secrets.sarah).toEqual([
      { text: 'Sarah knits.', tier: 'friendly' },
      { text: 'Sarah lied.', tier: 'trusted' },
      { text: 'Sarah left.', tier: 'devoted' }
    ])
    for (const c of ROSTER) {
      expect(Object.keys(semester.schedules.perChar[c.charId].schedule).length).toBeGreaterThan(0)
    }
    vi.restoreAllMocks()
  })

  it('lifts a generated year to what her decided dorm allows', () => {
    const decided = {
      mia_park: decidedProfileOf({ dorm: 'elysium' })
    }
    const reply = {
      characters: [
        { ...profileRow('sarah_rose', 'Art'), year: 1 },
        { ...profileRow('mia_park', 'Art'), year: 1 }
      ]
    }
    const profiles = validateProfileDraft(reply as unknown as ProfileGenReply, ROSTER, decided)
    expect(profiles.characters.mia_park).toMatchObject({ year: 3, dorm: 'elysium' })
    expect(profiles.characters.sarah_rose).toMatchObject({ year: 1 })
  })

  it('generates a half-written entry whole and names it as incomplete', () => {
    const draft = draftOf({ occasions: { gala: { title: 'The Lantern Ball', description: ' ' } } })
    expect(askedIds(draft)).toEqual([GALA.id, FILLER.id])
    expect(incompleteOf(draft, 'occasions')).toEqual([{ kind: 'occasion', id: 'gala' }])
  })
})

describe('a later semester', () => {
  const ANNA = character({ charId: 'anna', firstName: 'Anna', lastName: 'Bell' })
  const JUNE = character({ charId: 'june', firstName: 'June', lastName: 'Cole' })
  const LIV = character({ charId: 'liv', firstName: 'Liv', lastName: 'Dunn' })
  const OLIVE = character({ charId: 'olive', firstName: 'Olive', lastName: 'Gray' })
  const PIA = character({ charId: 'pia', firstName: 'Pia', lastName: 'Hart' })
  const GRACE = character({ charId: 'grace', firstName: 'Grace', lastName: 'Ivy' })
  const LATER = [ANNA, JUNE, LIV]
  const LATER_WORLD: RequestWorld = { ...WORLD, graduates: [OLIVE, PIA, GRACE] }

  /** A settled profile from the semester before. */
  const prior = (over: Partial<CharProfile>): CharProfile => ({
    year: 4,
    dorm: 'lowrise_1',
    major: 'History',
    schedule: {},
    ...over
  })

  const CONTINUED: ApplicationContinuation = {
    id: 'later',
    index: 2,
    continuing: ['anna'],
    graduated: ['grace'],
    alumni: ['olive', 'pia', 'grace'],
    priorProfiles: {
      anna: prior({
        year: 2,
        dorm: 'lowrise_3',
        major: 'Biology',
        schedule: { 0: 'BIO 101', 3: 'ENG 101', 5: 'PE 101', 7: 'BIO 102' },
        handle: 'anna.b'
      }),
      olive: prior({ major: 'Art', pursuing: 'teaching in Seoul' }),
      pia: prior({ major: 'Music', pursuing: 'nursing in Ohio' }),
      grace: prior({ major: 'History' })
    },
    jobs: { anna: { jobId: 'cutetea', count: 2 } },
    haunts: {
      anna: { homeSlots: 2, study: 'kendall_library', fun: [], activity: null, meal: null }
    },
    majorLoads: { anna: 2 },
    carry: {
      charInfo: { anna: charInfo({ secrets: [{ text: 'Anna lied.', tier: 'friendly' }] }) }
    } as unknown as SemesterCarry,
    taken: [{ code: 'BIO 101', name: 'Cells' }]
  }

  /** A later fall with June decided in full and Liv's major alone. */
  function laterDraft(over: Partial<ApplicationDraft> = {}): ApplicationDraft {
    return {
      screen: 'loading',
      season: 'fall',
      chars: LATER.map((c) => c.charId),
      plan: [],
      occasions: {},
      catalog: emptyCatalog(),
      girls: {
        june: {
          profile: {
            year: 1,
            major: 'biology',
            classesTaken: 4,
            majorClassesTaken: 1,
            job: null,
            dorm: 'lowrise_2',
            homeSlots: 2,
            study: null,
            fun: [],
            activity: null,
            meal: null,
            handle: 'june.c'
          },
          secrets: {},
          memories: []
        },
        liv: { profile: { major: 'Physics' }, secrets: {}, memories: [] }
      },
      pairs: {},
      replies: {},
      continued: CONTINUED,
      pursuits: { grace: 'Teaching in Japan.', olive: 'Running for mayor.' },
      ...over
    }
  }

  /** The request a later semester's call needs. */
  function laterRequest(call: NewGameCall, draft: ApplicationDraft): CallRequest {
    const need = needOf(call, draft, LATER, LATER_WORLD)
    if (typeof need === 'string') throw new Error(`${call} needs ${need}`)
    return need
  }

  /** The later draft with `reply` banked for `call`. */
  function bankedLater(call: NewGameCall, draft: ApplicationDraft, reply: unknown): ApplicationDraft {
    const need = laterRequest(call, draft)
    need.check(reply)
    return { ...draft, replies: { ...draft.replies, [call]: { key: need.key, reply } } }
  }

  const PROFILE_REPLY = {
    characters: [profileRow('liv_dunn', 'Chemistry')],
    returning: [{ key: 'anna_bell', breakPosts: ['beach day'] }],
    graduates: [
      { key: 'olive_gray', pursuing: 'Running a gallery in Rome', breakPosts: ['ciao'] },
      { key: 'grace_ivy', pursuing: 'selling boats', breakPosts: ['hi'] }
    ]
  }

  it("asks for the returning girls and graduates beside whoever has a blank, with a graduate's own words", () => {
    const { request } = laterRequest('profiles', laterDraft())
    const groups = request.schema.schema.properties as Record<
      string,
      { items: { properties: { key: { enum: string[] } } } }
    >
    const keysOf = (group: string): string[] => groups[group].items.properties.key.enum

    expect(Object.keys(groups)).toEqual(['characters', 'returning', 'graduates'])
    expect(keysOf('characters')).toEqual(['liv_dunn'])
    expect(keysOf('returning')).toEqual(['anna_bell'])
    expect(keysOf('graduates')).toEqual(['olive_gray', 'pia_hart', 'grace_ivy'])
    expect(request.user).toContain('"Teaching in Japan."')
    // Only a girl who graduated at this ending is the player's to write.
    expect(request.user).not.toContain('Running for mayor.')
  })

  it("reads the class call the same before and after the profile reply, a new girl's major spelt as a returning one's", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let draft = laterDraft()
    const before = laterRequest('classes', draft).key
    expect(majorsOf(draft, LATER, LATER_WORLD)).toEqual({
      anna: 'Biology',
      june: 'Biology',
      liv: 'Physics'
    })
    draft = bankedLater('profiles', draft, PROFILE_REPLY)
    expect(laterRequest('classes', draft).key).toBe(before)
    vi.restoreAllMocks()
  })

  it('keeps what a returning girl carries and gives her and the graduates only what is new', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let draft = laterDraft()
    draft = bankedLater('profiles', draft, PROFILE_REPLY)
    draft = bankedLater('secrets', draft, {
      devoted: [{ key: 'anna_bell', devoted: 'Anna ran away once.' }],
      characters: ['june_cole', 'liv_dunn'].map((key) => ({
        key,
        friendly: 'She sings.',
        trusted: 'She cried.',
        devoted: 'She ran.'
      }))
    })
    const course = (code: string, category: string, major?: string): Record<string, unknown> => ({
      code,
      name: code,
      description: `${code}.`,
      category,
      ...(major ? { major } : {}),
      kind: 'lecture'
    })
    draft = bankedLater('classes', draft, {
      characters: Object.fromEntries(
        ['anna_bell', 'june_cole', 'liv_dunn'].map((key, i) => [
          key,
          { interestClass: { code: `ART 10${i}`, name: 'Pots', description: 'Pots.', kind: 'project' } }
        ])
      ),
      classes: [
        course('BIO 201', 'major', 'Biology'),
        course('BIO 202', 'major', 'Biology'),
        course('BIO 203', 'major', 'Biology'),
        course('BIO 204', 'major', 'Biology'),
        course('BIO 205', 'major', 'Biology'),
        course('PHY 201', 'major', 'Physics'),
        course('PHY 202', 'major', 'Physics'),
        course('PE 201', 'pe'),
        course('PE 202', 'pe'),
        course('HIS 201', 'humanities'),
        course('HIS 202', 'humanities'),
        course('MUS 201', 'arts'),
        course('MUS 202', 'arts'),
        course('GEN 201', 'misc'),
        course('GEN 202', 'misc')
      ]
    })

    const semester = composeApplication(draft, LATER, LATER_WORLD)

    // Her four classes and the two of them in her major.
    expect(semester.schedules.perChar.anna).toMatchObject({
      year: 2,
      dorm: 'lowrise_3',
      major: 'Biology'
    })
    const annas = Object.values(semester.schedules.perChar.anna.schedule)
    expect(annas).toHaveLength(4)
    const inMajor = annas.filter((code) => semester.schedules.classes[code].category === 'major')
    expect(inMajor).toHaveLength(2)
    expect(semester.jobs.anna).toEqual(CONTINUED.jobs.anna)
    expect(semester.haunts.anna).toEqual(CONTINUED.haunts.anna)
    expect(semester.feeds.anna).toEqual({ handle: 'anna.b', winterPosts: ['beach day'] })
    expect(semester.feeds.olive.winterPosts).toEqual(['ciao'])
    expect(semester.feeds.pia.winterPosts).toEqual([])
    expect(semester.feeds.liv.winterPosts).toEqual([])
    expect(semester.pursuits).toEqual({
      olive: 'running a gallery in Rome',
      pia: 'nursing in Ohio',
      grace: 'teaching in Japan'
    })
    expect(semester.secrets.anna).toEqual([{ text: 'Anna ran away once.', tier: 'devoted' }])
    vi.restoreAllMocks()
  })
})
