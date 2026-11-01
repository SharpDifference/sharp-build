import type { GlobalTextId, TextEdits } from '@shared/presets/types'
import { blockText } from '@shared/presets/textBlocks'
import { withAdditions } from './promptBlocks'
import { CLASS_CATALOG_RANGES, DEFAULT_CLASS_CATALOG, type ClassCatalogEdits, type ClassCatalogKey } from '@shared/presets/studioPrompts'
import {
  charKeyOf,
  fullNameOf,
  type Character,
  type ClassCategory,
  type CourseEntry,
  type PeClassEntry,
  type StructuredRequest
} from '@shared/types'
import { rollDifficulty, rollProfessor, type ClassKind } from '@shared/academics'
import {
  CATALOG_POOLS,
  type CatalogEntry,
  type CatalogPool
} from '@shared/application'
import { freeClassCode } from '@shared/classes'
import type { DormId } from '@shared/dorms'
import { appError } from '@shared/errors'
import { LAST_NAMES } from './characterSuggestions'
import { objectSchema } from './schema'

/**
 * Builds and validates the one-shot class-generation request; pure, no IO. It asks only for
 * what nobody has decided: the classes each pool and major is still short of, and the interest
 * class of each student who has none written. Every student's major is decided before the call.
 */

/** Categories the model may return. `interest` is ours, applied after parsing. */
const GENERATED_CATEGORIES = ['pe', 'humanities', 'arts', 'major', 'misc'] as const

/** One catalog entry as the model returns it — no slot yet (the scheduler deals those). */
export interface ClassDraft {
  code: string
  name: string
  description: string
  category: ClassCategory
  major?: string
  /** Lecture or project. Asked of every course; PE loses it in `decorateClasses`. */
  kind?: ClassKind
  /** charKey this was invented for; set only for `category: 'interest'`. */
  owner?: string
  /** The player wrote this class, so the scheduler seats girls in it first. Never saved. */
  written?: true
}

/** A draft after `decorateClasses`: PE without a kind, every other course decorated. */
export type DecoratedClassDraft = (Omit<PeClassEntry, 'slot'> | Omit<CourseEntry, 'slot'>) & {
  owner?: string
  written?: true
}

/** The four fields every course carries, before we label it. */
type CourseDraft = Pick<ClassDraft, 'code' | 'name' | 'description' | 'kind'>

/** One character's catalog-side profile, decided or as this call returned it. */
interface CharClassReply {
  major: string
  interestClass: { code: string; name: string; description: string; kind?: ClassKind }
}

/** One character's academic profile, both calls' halves joined. */
interface CharClassDraft extends CharClassReply {
  majorClassesTaken: number
  year: number
  dorm: DormId
  classesTaken: number
}

/** The validated catalog: each student's catalog-side profile by charKey, and the flat catalog. */
export interface ClassGenReply {
  characters: Record<string, CharClassReply>
  classes: ClassDraft[]
}

/** The reply as the model returns it, before any of it is trusted. */
export interface ClassReply {
  characters?: Record<string, Partial<Pick<CharClassReply, 'interestClass'>>>
  classes?: ClassDraft[]
}

/** One student as the class call reads her: her major, and her interest class where it is written. */
export interface ClassStudent {
  character: Character
  /** Her major, decided before the call. */
  major: string
  /** Her interest class, whole; asked where absent. */
  interest?: CatalogEntry
}

/** The whole entries the player wrote, by pool and by major. */
export type FilledCatalog = Record<CatalogPool, readonly CatalogEntry[]> & {
  major: Readonly<Record<string, readonly CatalogEntry[]>>
}

/** Everything the class call is built from. */
export interface ClassPromptInput {
  catalog?: ClassCatalogEdits
  /** The roster, in order. */
  students: readonly ClassStudent[]
  filled: FilledCatalog
  /** Every class an earlier semester of this timeline ran, which may not be run again. */
  taken?: readonly { code: string; name: string }[]
  setting: string
}

/** A catalog with no entries written. */
export const NO_FILLED_CATALOG: FilledCatalog = {
  pe: [],
  humanities: [],
  arts: [],
  misc: [],
  major: {}
}

/** The merged draft, before decoration. */
export interface ClassGenDraft extends ClassGenReply {
  characters: Record<string, CharClassDraft>
}

/** {@link ClassGenDraft} once `decorateClasses` has run — what the scheduler consumes. */
export type DecoratedClassGenDraft = Omit<ClassGenDraft, 'classes'> & {
  classes: DecoratedClassDraft[]
}

/** What a reply's `kind` reads as: `project` when it says so, else `lecture`. */
function classKindOf(kind: unknown): ClassKind {
  return kind === 'project' ? 'project' : 'lecture'
}

/** An integer field with inclusive bounds. Shared with the profile call. */
export function intField(minimum: number, maximum: number): Record<string, unknown> {
  return { type: 'integer', minimum, maximum }
}

/** The shape of one catalog entry, shared by the catalog and interest classes. */
function courseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'name', 'description', 'kind'],
    properties: {
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      kind: { type: 'string', enum: ['lecture', 'project'] }
    }
  }
}

/** Every roster key, and the cast block the registrar and the profile call both open with. */
export function rosterCastLines(roster: readonly Character[]): {
  keys: string[]
  cast: string[]
} {
  const keys = roster.map((c) => charKeyOf(c.firstName, c.lastName))
  const cast = roster.flatMap((character, index) => [
    `${keys[index]} — ${fullNameOf(character)}`,
    character.personality,
    ''
  ])
  return { keys, cast }
}

/** What the call asks of one student, by field. */
function askedOf(student: ClassStudent): { interestClass: boolean } {
  return { interestClass: student.interest === undefined }
}

/** How many classes each pool, and each decided major, is still short of. */
/** Prompt Studio pool sizes, validated before they affect generation. */
export function catalogSize(catalog: ClassCatalogEdits | undefined, key: ClassCatalogKey): number {
  const size = catalog?.[key]
  const { min, max } = CLASS_CATALOG_RANGES[key]
  return typeof size === 'number' && Number.isInteger(size) && size >= min && size <= max ? size : DEFAULT_CLASS_CATALOG[key]
}

export function shortfallOf(input: ClassPromptInput): {
  pools: Record<CatalogPool, number>
  majors: [string, number][]
} {
  const pools = Object.fromEntries(
    CATALOG_POOLS.map((pool) => [pool, Math.max(0, catalogSize(input.catalog, pool === 'pe' ? 'pe' : 'filler') - input.filled[pool].length)])
  ) as Record<CatalogPool, number>
  const decided = [...new Set(input.students.flatMap((s) => (s.major ? [s.major] : [])))]
  const majors = decided.map(
    (major) =>
      [major, Math.max(0, catalogSize(input.catalog, 'perMajor') - (input.filled.major[major]?.length ?? 0))] as [
        string,
        number
      ]
  )
  return { pools, majors }
}

/** What each pool is called in the prompt, and the category the model files it under. */
const POOL_LINES: Record<CatalogPool, string> = {
  pe: 'physical education classes (category "pe")',
  humanities: 'humanities classes (category "humanities")',
  arts: 'arts classes (category "arts")',
  misc: 'miscellaneous classes (category "misc") that fit no other pool'
}

/**
 * Builds the class-catalog request, or null when every class it could ask for is already
 * written. A next semester's passes `taken`, so the catalog keeps away from every class run.
 */
export function buildClassPrompt(input: ClassPromptInput, textEdits?: TextEdits<GlobalTextId>): StructuredRequest | null {
  const { students } = input
  const keys = students.map(({ character }) => charKeyOf(character.firstName, character.lastName))
  const asked = students.map(askedOf)
  const askInterest = asked.some((a) => a.interestClass)
  const { pools, majors } = shortfallOf(input)
  const majorsShort = majors.filter(([, count]) => count > 0)
  const askClasses = majorsShort.length > 0 || CATALOG_POOLS.some((pool) => pools[pool] > 0)
  if (!askClasses && !askInterest) return null

  const taken = input.taken ?? []
  const written = [
    ...CATALOG_POOLS.flatMap((pool) => input.filled[pool]),
    ...Object.values(input.filled.major).flat(),
    ...students.flatMap((s) => (s.interest ? [s.interest] : []))
  ]

  const system = [withAdditions(blockText(textEdits, 'newgame.classes.system', [
    'You are a university registrar building a course catalog and enrolling students.',
    'You return a single JSON object matching the provided schema exactly.',
    'Course codes follow real university convention: a subject prefix and a three-digit number, like "BIO 210".'
  ].join(' ')), textEdits, 'newgame.classes.additions'), '', 'SETTING', input.setting].join('\n')

  const preamble = [
    blockText(textEdits, 'newgame.classes.instructions', [
    'Build a course catalog for a university, then enroll each student below.',
    ...(askInterest ? ['FOR EACH STUDENT'] : []),
    ...(askInterest
      ? [
          'interestClass: one course this specific student would sign up for out of pure personal interest.',
          'It should read like something only she would pick.'
        ]
      : []),
    ...(askInterest ? [''] : []),
    'Every course needs a one-sentence description written the way a real course catalog writes them.',
    '',
    'EVERY COURSE ALSO NEEDS A KIND',
    'kind "lecture": the class meets to be taught. The professor lectures, students take notes, and the course is assessed by a midterm and a final exam.',
    'kind "project": the class is built around producing work. Students spend the term making something, and the course is assessed by showcasing that work instead of by exams.',
    'Pick whichever genuinely fits the subject — a studio, a workshop or a design course is a project class; a survey, a theory or a history course is a lecture class.',
    'Physical education classes are neither, so answer "lecture" for those and it will be ignored.',
    '',
    ].join('\n')),
    ...(askClasses
      ? [
          'THE CATALOG',
          ...CATALOG_POOLS.flatMap((pool) =>
            pools[pool] > 0 ? [`Create ${pools[pool]} ${POOL_LINES[pool]}.`] : []
          ),
          ...(majorsShort.length > 0
            ? [
                'For each major under MAJORS, create as many classes as written beside it, with category "major" and that major\'s exact name in the "major" field. Leave "major" out for every other category.'
              ]
            : ['Leave "major" out of every class.']),
          ''
        ]
      : []),
    'RULE: every "code" in the whole reply must be unique, including the interest classes.',
    'No two courses may share a code.',
    ...(taken.length > 0
      ? [
          'Classes listed under ALREADY TAKEN ran in earlier semesters: never reuse one of their codes, and never recreate one of them under another code.'
        ]
      : []),
    ...(written.length > 0
      ? [
          'Classes listed under ALREADY IN THE CATALOG are written already: never reuse one of their codes, and never write one of them again under another code.'
        ]
      : []),
    '---', ''
  ].join('\n')

  // Below the '---' divider: the roster and what is written are all that varies, and the console
  // log starts here. Only a student the call asks something of is listed.
  const listed = students.flatMap((student, index) => {
    const a = asked[index]
    if (!a.interestClass) return []
    return [
      `${keys[index]} — ${fullNameOf(student.character)}`,
      `Majoring in ${student.major}.`,
      student.character.personality,
      ''
    ]
  })
  const rest = [
    ...(taken.length > 0
      ? ['ALREADY TAKEN', ...taken.map((entry) => `${entry.code} — ${entry.name}`), '']
      : []),
    ...(written.length > 0
      ? ['ALREADY IN THE CATALOG', ...written.map((entry) => `${entry.code} — ${entry.title}`), '']
      : []),
    ...(majorsShort.length > 0
      ? ['MAJORS', ...majorsShort.map(([major, count]) => `${major} — ${count}`), '']
      : []),
    ...(listed.length > 0 ? ['STUDENTS', ...listed] : [])
  ].join('\n')

  // Each student's record asks only for an interest class not yet written; one asked nothing is left out.
  const characters = Object.fromEntries(
    students.flatMap((_student, index) => {
      if (!asked[index].interestClass) return []
      const properties = { interestClass: courseSchema() }
      return [
        [
          keys[index],
          { type: 'object', additionalProperties: false, required: ['interestClass'], properties }
        ]
      ]
    })
  )
  const categories = GENERATED_CATEGORIES.filter((category) =>
    category === 'major' ? majorsShort.length > 0 : pools[category] > 0
  )
  const groups: Record<string, unknown> = {
    ...(Object.keys(characters).length > 0
      ? {
          characters: {
            type: 'object',
            additionalProperties: false,
            required: Object.keys(characters),
            properties: characters
          }
        }
      : {}),
    ...(askClasses
      ? {
          classes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'name', 'description', 'kind', 'category'],
              properties: {
                ...(courseSchema().properties as Record<string, unknown>),
                category: { type: 'string', enum: categories },
                // Closed to the majors still short, so a class cannot miss its major's spelling.
                ...(majorsShort.length > 0
                  ? { major: { type: 'string', enum: majorsShort.map(([major]) => major) } }
                  : {})
              }
            }
          }
        }
      : {})
  }
  const schema = objectSchema('class_schedule', Object.keys(groups), groups)

  // The roster is in the prompt, so this caches only across retries of the same New Game.
  return {
    system,
    user: `${preamble}\n${rest}`,
    schema,
    cacheKey: 'venus-university-class-generation',
    logFrom: preamble.length + 1
  }
}

/** Thrown as an `AppError` when the reply cannot be scheduled. */
function invalid(detail: string): never {
  throw appError('CLASS_GEN_INVALID', 'The generated class catalog was not usable.', detail)
}

/**
 * Clamps into range, warning when the model ignored its own schema bounds.
 * Shared with the profile call.
 */
export function clamp(value: number, min: number, max: number, what: string): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) {
    console.warn(`[classes] ${what} was not a number; using ${min}.`)
    return min
  }
  const held = Math.min(max, Math.max(min, n))
  if (held !== n) console.warn(`[classes] ${what} was ${n}; clamped to ${held}.`)
  return held
}

/** A whole entry the player wrote, as the model would have returned it. */
function courseDraftOf(entry: CatalogEntry): CourseDraft {
  return {
    code: entry.code,
    name: entry.title,
    description: entry.description,
    ...(entry.kind ? { kind: entry.kind } : {})
  }
}

/** A reply's entry less the marks only validation sets, which a custom endpoint may still send. */
function unmarked<T extends CourseDraft>(entry: T | undefined): T {
  if (typeof entry !== 'object' || entry === null) return {} as T
  const marked = entry as T & Pick<ClassDraft, 'owner' | 'written'>
  const { owner: _owner, written: _written, ...rest } = marked
  return rest as T
}

/**
 * Validates a reply (absent where nothing was asked) into the catalog: the player's entries
 * first, marked written, then the model's, a code used twice renumbered on the later one — every
 * code an earlier semester ran counting as used — and every student's interest class folded in.
 * A student's decided major and interest class stand over whatever the reply says of them.
 */
export function validateClassDraft(
  reply: ClassReply | undefined,
  input: Pick<ClassPromptInput, 'students' | 'filled' | 'taken'> & {
    /** Major classes may belong to no major, and a major with none of its own is no refusal. */
    openMajors?: boolean
  }
): ClassGenReply {
  const seen = new Map<string, string>()
  for (const entry of input.taken ?? []) seen.set(entry.code, 'an earlier semester')

  const add = <T extends CourseDraft>(entry: T, origin: string): T => {
    let code = (entry?.code ?? '').trim()
    if (!code) invalid(`${origin} has a blank course code.`)
    const prior = seen.get(code)
    if (prior) {
      const renumbered = freeClassCode(code, (c) => seen.has(c))
      console.warn(
        `[classes] Course code "${code}" is used twice: ${prior} and ${origin}; ${origin} is now "${renumbered}".`
      )
      code = renumbered
    }
    seen.set(code, origin)
    return {
      ...entry,
      code,
      name: (entry.name ?? '').trim(),
      description: (entry.description ?? '').trim(),
      // A bad kind falls back to lecture.
      kind: classKindOf(entry.kind)
    }
  }

  // The player's own codes are taken first, so a reply repeating one is the one renumbered.
  const catalog: ClassDraft[] = []
  for (const pool of CATALOG_POOLS) {
    for (const entry of input.filled[pool]) {
      catalog.push({
        ...add(courseDraftOf(entry), `your ${pool} class "${entry.title}"`),
        category: pool,
        written: true
      })
    }
  }
  for (const [major, entries] of Object.entries(input.filled.major)) {
    for (const entry of entries) {
      catalog.push({
        ...add(courseDraftOf(entry), `your ${major} class "${entry.title}"`),
        category: 'major',
        major,
        written: true
      })
    }
  }
  const interests = new Map<string, CourseDraft>()
  for (const student of input.students) {
    if (!student.interest) continue
    const key = charKeyOf(student.character.firstName, student.character.lastName)
    interests.set(key, add(courseDraftOf(student.interest), `${key}'s interest class`))
  }

  for (const entry of reply?.classes ?? []) {
    catalog.push(add(unmarked(entry), `catalog entry "${entry?.name ?? '?'}"`))
  }

  const majorsOffered = new Set(
    catalog.filter((c) => c.category === 'major' && c.major).map((c) => c.major as string)
  )

  const characters: Record<string, CharClassReply> = {}
  for (const student of input.students) {
    const { character } = student
    const key = charKeyOf(character.firstName, character.lastName)
    const profile = reply?.characters?.[key]
    if (askedOf(student).interestClass && !profile) {
      invalid(`${fullNameOf(character)} was left unenrolled.`)
    }

    const major = student.major.trim()
    if (!input.openMajors && !majorsOffered.has(major)) {
      invalid(`No classes were created for ${character.firstName}'s major, "${major}".`)
    }

    const own = interests.get(key)
    const interest =
      own ?? add(unmarked(profile?.interestClass as CourseDraft), `${key}'s interest class`)
    characters[key] = {
      major,
      interestClass: interest
    }
    catalog.push({
      ...interest,
      category: 'interest',
      owner: key,
      ...(own ? { written: true as const } : {})
    })
  }

  return { characters, classes: catalog }
}

/** The catalog dealt for a skipped class call, as the call would have answered it. */
export interface DealtClasses {
  pools: Record<CatalogPool, CatalogEntry[]>
  /** Major classes of no major in particular, which any girl's major load may take. */
  open: CatalogEntry[]
  /** Each girl's interest class, by charKey. */
  interest: Record<string, CatalogEntry>
}

/**
 * A dealt catalog in the reply's own shape, for {@link validateClassDraft} with `openMajors`:
 * each pool's entries under its category, the open ones as major classes of no major, and an
 * interest class for every student without one of her own.
 */
export function dealtClassReply(dealt: DealtClasses, students: readonly ClassStudent[]): ClassReply {
  const characters: Record<string, Partial<CharClassReply>> = {}
  for (const student of students) {
    if (student.interest) continue
    const key = charKeyOf(student.character.firstName, student.character.lastName)
    const interest = dealt.interest[key]
    if (interest) characters[key] = { interestClass: courseDraftOf(interest) }
  }
  return {
    characters,
    classes: [
      ...CATALOG_POOLS.flatMap((pool) =>
        dealt.pools[pool].map((entry): ClassDraft => ({ ...courseDraftOf(entry), category: pool }))
      ),
      ...dealt.open.map((entry): ClassDraft => ({ ...courseDraftOf(entry), category: 'major' }))
    ]
  }
}

/**
 * Rolls each course's professor and difficulty, and each PE class's coach. The sentences those
 * rolls are worth are never written down: `description` stays the catalog blurb the model wrote,
 * and `fullDescriptionOf` speaks the rolls beside it when a prompt asks.
 */
export function decorateClasses<T extends { classes: ClassDraft[] }>(
  draft: T,
  lastNames: readonly string[] = LAST_NAMES,
  rand: () => number = Math.random
): Omit<T, 'classes'> & { classes: DecoratedClassDraft[] } {
  return {
    ...draft,
    classes: draft.classes.map((entry): DecoratedClassDraft => {
      if (entry.category === 'pe') {
        const { kind: _kind, ...rest } = entry
        return { ...rest, category: 'pe', instructor: rollProfessor(lastNames, rand) }
      }
      // Both rolled, in this order, for every course: the scheduler tests pin the dice.
      const professor = rollProfessor(lastNames, rand)
      const difficulty = rollDifficulty(rand)
      return {
        ...entry,
        category: entry.category,
        kind: classKindOf(entry.kind),
        professor,
        difficulty
      }
    })
  }
}
