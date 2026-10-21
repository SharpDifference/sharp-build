import {
  charKeyOf,
  fullNameOf,
  type Character,
  type FeedAssignment,
  type HiddenScheduleAssignment,
  type JobAssignment,
  type Season,
  type StructuredRequest
} from '@shared/types'
import { DORM_IDS, FALLBACK_DORM, isDorm, type DormId } from '@shared/dorms'
import { availableLocationMenu, jobAvailable } from '@shared/cityLife'
import { availableJobs, jobDefOf } from '@shared/jobs'
import {
  ACTIVITY_LOCATIONS,
  FUN_LOCATIONS,
  MEAL_LOCATIONS,
  STUDY_LOCATIONS,
  locationForKey,
  locationLabel,
  locationMenuLines
} from '@shared/locations'
import { fallbackHandleOf } from '@shared/feed'
import type { GlobalTextId, TextEdits } from '@shared/presets/types'
import { appError } from '@shared/errors'
import {
  clamp,
  intField,
  rosterCastLines,
  type ClassGenDraft,
  type ClassGenReply
} from './classPrompt'
import { keyPattern, loreEntryById } from './lorebook'
import { newGameText, withAdditions } from './promptBlocks'
import { objectSchema } from './schema'

/**
 * Builds and validates the one-shot student-profile request; pure, no IO.
 */

/** How many shifts a working character may be given. */
const MAX_NPC_SHIFTS = 2

/** How many evenings a week a character may be asked to stay in. */
const MIN_HOME_SLOTS = 1
const MAX_HOME_SLOTS = 3

/** How many places she may go out to for fun. */
const MAX_FUN_LOCATIONS = 2

/** One character's profile as the model returns it. */
interface CharProfileDraft {
  year: number
  classesTaken: number
  /** Where she lives on campus — a {@link DormId}. */
  dorm: DormId
  /** A `JobDef.id`, or `''` for a character who holds no job. */
  job: string
  /** How many weekly shifts she works; 0 whenever `job` is blank. */
  jobShifts: number
  /** How many slots a week she spends in her own room. */
  homeSlots: number
  /** A `STUDY_LOCATIONS` key, or `''` for a character who studies in her room. */
  study: string
  /** Up to {@link MAX_FUN_LOCATIONS} `FUN_LOCATIONS` keys; empty for a homebody. */
  fun: string[]
  /** The weekly interest in her own words — "sketching at the Whitman Greenhouse" — or `''`. */
  activity: string
  /** The `ACTIVITY_LOCATIONS` key {@link activity} happens at, or `''` when it is blank. */
  activityLocation: string
  /** A `MEAL_LOCATIONS` key, or `''` for a character who eats in. */
  meal: string
  /** Her social handle, repaired to `fallbackHandleOf` when unusable. */
  handle: string
  /** What she posted over the winter break, nought to {@link MAX_WINTER_POSTS}; upperclassmen only. */
  winterPosts: string[]
  /** What she does with spring break, as one short phrase; whether she goes is the save's to settle. */
  springBreakPlans: string
}

/** The most winter-break posts one character may arrive with. */
const MAX_WINTER_POSTS = 3

/** The validated shape every consumer reads: profiles keyed by charKey. */
export interface ProfileGenDraft {
  characters: Record<string, CharProfileDraft>
}

/** The whole reply as the model returns it: one record per student, each naming its charKey. */
export interface ProfileGenReply {
  characters: Array<CharProfileDraft & { key: string }>
}

/** A handle as it will be printed, or `''` when nothing is salvageable: strips a leading `@` and anything outside the prompt's character set. */
function normalizeHandle(raw: string): string {
  const stripped = raw.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')
  return /[a-z]/.test(stripped) ? stripped : ''
}

/**
 * Her activity phrase as it will be printed: no trailing full stop, and opening lowercase unless
 * its first word carries a capital of its own, which makes it a name or an acronym like "DJing".
 */
function normalizeActivity(raw: unknown): string {
  const text = (typeof raw === 'string' ? raw : '').trim().replace(/\.+$/, '').trim()
  if (text === '') return ''
  const first = text.split(/\s+/)[0]
  return /[A-Z]/.test(first.slice(1)) ? text : text[0].toLowerCase() + text.slice(1)
}

/** Whether a phrase already says where it happens, by the lorebook keys of the place it names. */
function namesLocation(phrase: string, locationId: string): boolean {
  const keys = loreEntryById(locationId)?.keys ?? []
  if (keys.length === 0) return false
  return new RegExp(keys.map((key) => keyPattern(key)).join('|'), 'i').test(phrase)
}

/** Thrown as an `AppError` when the reply cannot be used. */
function invalid(detail: string): never {
  throw appError('PROFILE_GEN_INVALID', 'The generated student profiles were not usable.', detail)
}

/** Her job, and the employers she may hold one at. */
function workLines(): string[] {
  const employers = availableJobs().map((def) => `${def.id} — ${def.employer}, ${def.title}: ${def.blurb}`)
  return [
    'PART-TIME WORK',
    'If the student works a part-time job, you can describe it as follows:',
    'job: the id of the employer she works for, exactly as written below. Leave empty if she has no job.',
    `jobShifts: how many shifts a week she works, 1 or ${MAX_NPC_SHIFTS} when she has a job, and 0 when she does not.`,
    '',
    'EMPLOYERS',
    ...employers,
    ''
  ]
}

/** Where she habitually goes, and the menus each habit is picked from; `freeTime` is her interest and meals prose. */
function hauntLines(freeTime: string): string[] {
  return [
    'WHERE SHE SPENDS HER FREE TIME',
    'Decide some places where she goes by habit. Answer with the keys below, exactly as written:',
    `homeSlots: how many times a week she stays in her own room, ${MIN_HOME_SLOTS} to ${MAX_HOME_SLOTS}.`,
    'study: where she goes to study, or an empty string if she studies in her own room.',
    `fun: 0 to ${MAX_FUN_LOCATIONS} places she goes out to enjoy herself. Leave it empty for somebody who does not go out.`,
    freeTime,
    '',
    'STUDY LOCATIONS',
    ...locationMenuLines(availableLocationMenu(STUDY_LOCATIONS)),
    '',
    'FUN LOCATIONS',
    ...locationMenuLines(availableLocationMenu(FUN_LOCATIONS)),
    '',
    'MEAL LOCATIONS',
    ...locationMenuLines(availableLocationMenu(MEAL_LOCATIONS)),
    '',
    'ACTIVITY LOCATIONS',
    ...locationMenuLines(availableLocationMenu(ACTIVITY_LOCATIONS)),
    ''
  ]
}

/** How the posts she made over a break are asked for, `field` being the field that holds them. */
function breakPostsLine(field: string, breakName: string): string {
  return `${field}: nought to ${MAX_WINTER_POSTS} short status updates she posted over the ${breakName}, oldest first. Keep these casual, using lowercase and/or emoji if it suits her. Don't address them to anyone, like other students or the reader.`
}

/** Builds the student-profile request; `textEdits` are the player's edits to its text. */
export function buildProfilePrompt(
  roster: readonly Character[],
  textEdits?: TextEdits<GlobalTextId>
): StructuredRequest {
  const { keys, cast } = rosterCastLines(roster)

  const system = withAdditions(
    newGameText(textEdits, 'newgame.profiles.system'),
    textEdits,
    'newgame.profiles.additions'
  )

  const preamble = [
    'FOR EACH STUDENT',
    'year: 1 = Freshman, 2 = Sophomore, 3 = Junior, 4 = Senior.',
    newGameText(textEdits, 'newgame.profiles.instructions'),
    '',
    ...workLines(),
    'HOUSING',
    newGameText(textEdits, 'newgame.profiles.housing'),
    '',
    ...hauntLines(newGameText(textEdits, 'newgame.profiles.freeTime')),
    'SOCIAL MEDIA',
    newGameText(textEdits, 'newgame.profiles.handle'),
    breakPostsLine('winterPosts', 'winter break'),
    'First-year students get no posts, leave the array empty. Everyone else gets at least one.',
    '',
    'SPRING BREAK',
    newGameText(textEdits, 'newgame.profiles.springBreak'),
    '---',
    ''
  ].join('\n')

  // Below the '---' divider: the roster is all that varies, and the console log starts here.
  const rest = [
    'characters holds one entry per student below, its key exactly as written before her name, in the order listed.',
    '',
    'STUDENTS',
    ...cast
  ].join('\n')

  const charSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'year',
      'classesTaken',
      'dorm',
      'job',
      'jobShifts',
      'homeSlots',
      'study',
      'fun',
      'activity',
      'handle',
      'winterPosts',
      'springBreakPlans',
      'activityLocation',
      'meal'
    ],
    properties: {
      year: intField(1, 4),
      classesTaken: intField(3, 6),
      // Closed like `job`: the dorm list is code, identical in every save.
      dorm: { type: 'string', enum: [...DORM_IDS] },
      job: { type: 'string', enum: ['', ...availableJobs().map((def) => def.id)] },
      jobShifts: intField(0, MAX_NPC_SHIFTS),
      homeSlots: intField(MIN_HOME_SLOTS, MAX_HOME_SLOTS),
      // Closed for `job`'s reason; `''` is legal in the two optional ones and is the ordinary answer.
      study: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(STUDY_LOCATIONS))] },
      fun: {
        type: 'array',
        maxItems: MAX_FUN_LOCATIONS,
        items: { type: 'string', enum: [...Object.keys(availableLocationMenu(FUN_LOCATIONS))] }
      },
      // Her own phrase, unlike the closed menus: the place it happens at rides `activityLocation`.
      activity: { type: 'string' },
      handle: { type: 'string' },
      winterPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } },
      springBreakPlans: { type: 'string' },
      activityLocation: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(ACTIVITY_LOCATIONS))] },
      meal: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(MEAL_LOCATIONS))] }
    }
  }

  // Gemini rejects a schema past a complexity cap with a bare INVALID_ARGUMENT: this record
  // keyed once per roster member passes at ten students and fails at eleven, while one item
  // schema in an array costs the same at any roster size. Left boundless — minItems or
  // maxItems on the array trips the cap again.
  const schema = objectSchema('student_profiles', ['characters'], {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', ...charSchema.required],
        properties: { key: { type: 'string', enum: keys }, ...charSchema.properties }
      }
    }
  })

  // The roster is in the prompt, so this caches only across retries of the same New Game.
  return {
    system,
    user: `${preamble}\n${rest}`,
    schema,
    cacheKey: 'venus-university-profile-generation',
    logFrom: preamble.length + 1
  }
}

/**
 * Folds the reply's array of records into one keyed by charKey: an entry that is not an
 * object, or whose key names nobody on the roster, is dropped; the first entry for a key
 * wins over any later duplicate.
 */
function foldByKey(
  reply: ProfileGenReply,
  keys: ReadonlySet<string>
): Record<string, CharProfileDraft> {
  const list: unknown = reply?.characters
  const folded: Record<string, CharProfileDraft> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) {
      console.warn('[profiles] a characters entry was not an object; skipping it.')
      continue
    }
    const entry = raw as Record<string, unknown>
    const key = typeof entry.key === 'string' ? entry.key.trim() : ''
    if (!keys.has(key)) {
      console.warn(`[profiles] a characters entry named the unknown key "${key}"; skipping it.`)
      continue
    }
    if (folded[key]) {
      console.warn(`[profiles] ${key} was profiled twice; keeping the first.`)
      continue
    }
    folded[key] = entry as unknown as CharProfileDraft
  }
  return folded
}

/** Validates a reply. */
export function validateProfileDraft(
  reply: ProfileGenReply,
  roster: readonly Character[]
): ProfileGenDraft {
  const validKeys = new Set(roster.map((c) => charKeyOf(c.firstName, c.lastName)))
  const folded = foldByKey(reply, validKeys)
  const characters: Record<string, CharProfileDraft> = {}

  for (const character of roster) {
    const key = charKeyOf(character.firstName, character.lastName)
    const profile = folded[key]
    if (!profile) invalid(`${fullNameOf(character)} was left unprofiled.`)
    characters[key] = validatedProfile(character, key, profile)
  }

  return { characters }
}

/** One student's profile as the model wrote it, every field repaired or clamped into range. */
function validatedProfile(
  character: Character,
  key: string,
  profile: CharProfileDraft
): CharProfileDraft {
  const job = (profile.job ?? '').trim()
  const known = job !== '' && Boolean(jobDefOf(job)) && jobAvailable(job)
  if (job !== '' && !known) {
    console.warn(`[profiles] ${key} was given the unknown employer "${job}"; leaving her jobless.`)
  }
  const jobShifts = known ? clamp(profile.jobShifts, 0, MAX_NPC_SHIFTS, `${key} jobShifts`) : 0

  // An unknown dorm is repaired to the fallback, like the job, not fatal.
  const dorm = (profile.dorm ?? '').trim()
  if (!isDorm(dorm)) {
    console.warn(`[profiles] ${key} was housed in the unknown dorm "${dorm}"; using ${FALLBACK_DORM}.`)
  }

  // An unknown haunt is dropped, like the job, not fatal.
  const menuKey = (menu: Record<string, string>, value: unknown, field: string): string => {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (raw === '') return ''
    if (locationForKey(availableLocationMenu(menu), raw) === null) {
      console.warn(`[profiles] ${key} ${field} was the unknown location "${raw}"; dropping it.`)
      return ''
    }
    return raw.toLowerCase()
  }

  const fun: string[] = []
  for (const entry of Array.isArray(profile.fun) ? profile.fun : []) {
    const resolved = menuKey(FUN_LOCATIONS, entry, 'fun')
    if (resolved !== '' && !fun.includes(resolved) && fun.length < MAX_FUN_LOCATIONS) {
      fun.push(resolved)
    }
  }

  // The phrase and the place it happens at stand or fall together: either alone says nothing.
  let activity = normalizeActivity(profile.activity)
  let activityLocation = menuKey(ACTIVITY_LOCATIONS, profile.activityLocation, 'activityLocation')
  if ((activity === '') !== (activityLocation === '')) {
    console.warn(
      `[profiles] ${key} gave the activity "${activity}" at "${activityLocation}"; dropping both.`
    )
    activity = ''
    activityLocation = ''
  }
  const activityId = activityLocation ? locationForKey(ACTIVITY_LOCATIONS, activityLocation) : null
  // Her phrase is printed in place of the location, so one that never says it has it appended.
  if (activityId && !namesLocation(activity, activityId)) {
    activity = `${activity} at ${locationLabel(activityId)}`
  }

  // The handle and her winter posts are repaired, like the job, not fatal.
  const year = clamp(profile.year, 1, 4, `${key} year`)
  const rawHandle = typeof profile.handle === 'string' ? profile.handle.trim() : ''
  const handle = normalizeHandle(rawHandle)
  if (handle === '') {
    console.warn(`[profiles] ${key} was given the unusable handle "${rawHandle}"; deriving one.`)
  }

  const winterPosts: string[] = []
  // A freshman gets no posts, whatever the model wrote.
  if (year > 1) {
    for (const entry of Array.isArray(profile.winterPosts) ? profile.winterPosts : []) {
      const text = typeof entry === 'string' ? entry.trim() : ''
      if (text !== '' && winterPosts.length < MAX_WINTER_POSTS) winterPosts.push(text)
    }
  }

  // Repaired to blank, not fatal.
  const springBreakPlans =
    typeof profile.springBreakPlans === 'string' ? profile.springBreakPlans.trim() : ''
  if (springBreakPlans === '') {
    console.warn(`[profiles] ${key} was given no spring break plans.`)
  }

  return {
    year,
    handle: handle === '' ? fallbackHandleOf(character.firstName, character.lastName) : handle,
    winterPosts,
    springBreakPlans,
    dorm: isDorm(dorm) ? dorm : FALLBACK_DORM,
    classesTaken: clamp(profile.classesTaken, 3, 6, `${key} classesTaken`),
    // A job with no shifts is no job: the two fields are stored agreeing.
    job: known && jobShifts > 0 ? job : '',
    jobShifts: known ? jobShifts : 0,
    homeSlots: clamp(profile.homeSlots, MIN_HOME_SLOTS, MAX_HOME_SLOTS, `${key} homeSlots`),
    study: menuKey(STUDY_LOCATIONS, profile.study, 'study'),
    fun,
    activity,
    activityLocation,
    meal: menuKey(MEAL_LOCATIONS, profile.meal, 'meal')
  }
}

/** One graduate as a next semester's profile call reads her: her major and what she was doing. */
export interface GraduateBrief {
  character: Character
  major: string
  /** What she was doing last semester; absent for a girl who has only just graduated. */
  pursuing?: string
}

/** Who a next semester's profile call profiles, and before which season. */
export interface ContinuedProfileInput {
  season: Season
  /** The first-years arriving this semester, profiled in full. */
  newcomers: readonly Character[]
  /** The roster girls coming back, asked only for their break. */
  returning: readonly Character[]
  graduates: readonly GraduateBrief[]
}

/** A next semester's reply as the model returns it: one array per kind of student. */
export interface ContinuedProfileReply {
  newcomers?: Array<Partial<CharProfileDraft> & { key: string }>
  returning?: Array<{ key: string; breakPosts?: unknown; springBreakPlans?: unknown }>
  graduates?: Array<{ key: string; pursuing?: unknown; breakPosts?: unknown }>
}

/** A next semester's reply, validated. */
export interface ContinuedProfileDraft {
  /** The first-years' profiles, keyed by charKey, as a first semester's are. */
  newcomers: ProfileGenDraft
  /** What each returning girl and each graduate posted over the break, by charKey. */
  breakPosts: Record<string, string[]>
  /** Each returning girl's spring break plans, by charKey; empty before a fall. */
  springBreakPlans: Record<string, string>
  /** What each graduate is doing now, by charKey. */
  pursuits: Record<string, string>
}

/** The dorms a first-year may live in: the Lowrises, never the upperclassman townhouses. */
const FIRST_YEAR_DORMS = DORM_IDS.filter((dorm) => dorm !== 'elysium')

/** What the break before a `season` semester is called. */
function breakNameOf(season: Season): string {
  return season === 'fall' ? 'summer vacation' : 'winter break'
}

/** What a graduate is doing when the model gave nothing usable: last semester's, or a placeholder. */
export function fallbackPursuit(previous: string | undefined): string {
  return previous && previous.trim() !== '' ? previous.trim() : 'settling into life after college'
}

/**
 * Builds a next semester's profile request: the first-years in full, the returning girls' break,
 * and every graduate's life since.
 */
export function buildContinuedProfilePrompt(
  input: ContinuedProfileInput,
  textEdits?: TextEdits<GlobalTextId>
): StructuredRequest {
  const breakName = breakNameOf(input.season)
  const spring = input.season === 'spring'
  const springBreak = newGameText(textEdits, 'newgame.profiles.springBreak')

  const preamble = [
    'FOR EACH NEW STUDENT',
    newGameText(textEdits, 'newgame.profiles.next.newcomers'),
    newGameText(textEdits, 'newgame.profiles.instructions'),
    '',
    ...workLines(),
    'HOUSING',
    newGameText(textEdits, 'newgame.profiles.next.housing'),
    '',
    ...hauntLines(newGameText(textEdits, 'newgame.profiles.freeTime')),
    'SOCIAL MEDIA',
    newGameText(textEdits, 'newgame.profiles.handle'),
    '',
    ...(spring ? ['SPRING BREAK', springBreak, ''] : []),
    'FOR EACH RETURNING STUDENT',
    breakPostsLine('breakPosts', breakName),
    'Everyone gets at least one.',
    ...(spring ? [springBreak] : []),
    '',
    'FOR EACH GRADUATE',
    newGameText(textEdits, 'newgame.profiles.next.graduates'),
    breakPostsLine('breakPosts', breakName),
    'Everyone gets at least one.',
    '---',
    ''
  ].join('\n')

  const blocks: string[] = []
  const schemaGroups: Record<string, unknown> = {}

  if (input.newcomers.length > 0) {
    const { keys, cast } = rosterCastLines(input.newcomers)
    blocks.push('NEW STUDENTS', ...cast)
    const properties = {
      classesTaken: intField(3, 6),
      dorm: { type: 'string', enum: [...FIRST_YEAR_DORMS] },
      job: { type: 'string', enum: ['', ...availableJobs().map((def) => def.id)] },
      jobShifts: intField(0, MAX_NPC_SHIFTS),
      homeSlots: intField(MIN_HOME_SLOTS, MAX_HOME_SLOTS),
      study: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(STUDY_LOCATIONS))] },
      fun: {
        type: 'array',
        maxItems: MAX_FUN_LOCATIONS,
        items: { type: 'string', enum: [...Object.keys(availableLocationMenu(FUN_LOCATIONS))] }
      },
      activity: { type: 'string' },
      handle: { type: 'string' },
      ...(spring ? { springBreakPlans: { type: 'string' } } : {}),
      activityLocation: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(ACTIVITY_LOCATIONS))] },
      meal: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(MEAL_LOCATIONS))] }
    }
    schemaGroups.newcomers = keyedArray(keys, properties)
  }

  if (input.returning.length > 0) {
    const { keys, cast } = rosterCastLines(input.returning)
    blocks.push('RETURNING STUDENTS', ...cast)
    schemaGroups.returning = keyedArray(keys, {
      breakPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } },
      ...(spring ? { springBreakPlans: { type: 'string' } } : {})
    })
  }

  if (input.graduates.length > 0) {
    const { keys, cast } = rosterCastLines(input.graduates.map((graduate) => graduate.character))
    blocks.push('GRADUATES')
    input.graduates.forEach((graduate, index) => {
      const [line, personality] = cast.slice(index * 3, index * 3 + 2)
      blocks.push(
        line,
        `Majored in ${graduate.major}.`,
        ...(graduate.pursuing ? [`Last semester she was ${graduate.pursuing}.`] : []),
        personality,
        ''
      )
    })
    schemaGroups.graduates = keyedArray(keys, {
      pursuing: { type: 'string' },
      breakPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } }
    })
  }

  // Below the '---' divider: the students are all that varies, and the console log starts here.
  const groups = Object.keys(schemaGroups)
  const rest = [
    `${groups.join(', ')} each hold one entry per student under the heading of the same name below, its key exactly as written before her name, in the order listed.`,
    '',
    ...blocks
  ].join('\n')

  return {
    system: withAdditions(
      newGameText(textEdits, 'newgame.profiles.system'),
      textEdits,
      'newgame.profiles.additions'
    ),
    user: `${preamble}\n${rest}`,
    schema: objectSchema('student_profiles', groups, schemaGroups),
    cacheKey: `venus-university-profile-continued-${input.season}`,
    logFrom: preamble.length + 1
  }
}

/**
 * One array of records keyed by charKey: the shape a record per student has to take, since a
 * record keyed once per student trips Gemini's schema-complexity cap past ten of them.
 */
export function keyedArray(keys: readonly string[], properties: Record<string, unknown>): unknown {
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['key', ...Object.keys(properties)],
      properties: { key: { type: 'string', enum: [...keys] }, ...properties }
    }
  }
}

/** The records of one group keyed by charKey, an unknown or repeated key dropped. */
function foldGroup<T extends { key: string }>(
  list: unknown,
  keys: ReadonlySet<string>,
  group: string
): Record<string, T> {
  const folded: Record<string, T> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const key = typeof (raw as { key?: unknown }).key === 'string' ? (raw as T).key.trim() : ''
    if (!keys.has(key) || folded[key]) {
      console.warn(`[profiles] a ${group} entry named "${key}", unknown or repeated; skipping it.`)
      continue
    }
    folded[key] = raw as T
  }
  return folded
}

/** Up to the cap of non-blank posts out of whatever the model sent. */
function postsOf(raw: unknown): string[] {
  const posts: string[] = []
  for (const entry of Array.isArray(raw) ? raw : []) {
    const text = typeof entry === 'string' ? entry.trim() : ''
    if (text !== '' && posts.length < MAX_WINTER_POSTS) posts.push(text)
  }
  return posts
}

/**
 * Validates a next semester's reply: a first-year left unprofiled refuses it, as at New Game; a
 * returning girl or a graduate left out costs only her posts, and a graduate's life falls back to
 * last semester's.
 */
export function validateContinuedProfiles(
  reply: ContinuedProfileReply,
  input: ContinuedProfileInput
): ContinuedProfileDraft {
  const keyOf = (character: Character): string => charKeyOf(character.firstName, character.lastName)

  const newcomers: Record<string, CharProfileDraft> = {}
  const arrived = foldGroup<CharProfileDraft & { key: string }>(
    reply?.newcomers,
    new Set(input.newcomers.map(keyOf)),
    'newcomers'
  )
  for (const character of input.newcomers) {
    const key = keyOf(character)
    const profile = arrived[key]
    if (!profile) invalid(`${fullNameOf(character)} was left unprofiled.`)
    // A first-year is a freshman with nothing posted from before she arrived.
    const validated = validatedProfile(character, key, { ...profile, year: 1, winterPosts: [] })
    newcomers[key] = isDorm(validated.dorm) && validated.dorm !== 'elysium'
      ? validated
      : { ...validated, dorm: FALLBACK_DORM }
  }

  const breakPosts: Record<string, string[]> = {}
  const springBreakPlans: Record<string, string> = {}
  const returning = foldGroup<{ key: string; breakPosts?: unknown; springBreakPlans?: unknown }>(
    reply?.returning,
    new Set(input.returning.map(keyOf)),
    'returning'
  )
  for (const character of input.returning) {
    const key = keyOf(character)
    breakPosts[key] = postsOf(returning[key]?.breakPosts)
    const plans = returning[key]?.springBreakPlans
    if (input.season === 'spring' && typeof plans === 'string' && plans.trim() !== '') {
      springBreakPlans[key] = plans.trim()
    }
  }
  for (const [key, profile] of Object.entries(newcomers)) {
    if (input.season === 'spring' && profile.springBreakPlans) {
      springBreakPlans[key] = profile.springBreakPlans
    }
  }

  const pursuits: Record<string, string> = {}
  const graduates = foldGroup<{ key: string; pursuing?: unknown; breakPosts?: unknown }>(
    reply?.graduates,
    new Set(input.graduates.map((graduate) => keyOf(graduate.character))),
    'graduates'
  )
  for (const graduate of input.graduates) {
    const key = keyOf(graduate.character)
    const pursuing = graduates[key]?.pursuing
    const phrase = typeof pursuing === 'string' ? normalizeActivity(pursuing) : ''
    if (phrase === '') console.warn(`[profiles] ${key} was given no pursuit; keeping her last one.`)
    pursuits[key] = phrase === '' ? fallbackPursuit(graduate.pursuing) : phrase
    breakPosts[key] = postsOf(graduates[key]?.breakPosts)
  }

  return { newcomers: { characters: newcomers }, breakPosts, springBreakPlans, pursuits }
}


/** Joins the two New Game replies into the draft the scheduler consumes. */
export function mergeProfiles(classDraft: ClassGenReply, profiles: ProfileGenDraft): ClassGenDraft {
  const characters = Object.fromEntries(
    Object.entries(classDraft.characters).map(([key, entry]) => {
      const profile = profiles.characters[key]
      const classesTaken = profile?.classesTaken ?? 4
      const majorClassesTaken = Math.min(entry.majorClassesTaken, classesTaken)
      if (majorClassesTaken !== entry.majorClassesTaken) {
        console.warn(
          `[profiles] ${key} majorClassesTaken was ${entry.majorClassesTaken} of ${classesTaken};` +
            ` clamped to ${majorClassesTaken}.`
        )
      }
      return [
        key,
        {
          ...entry,
          year: profile?.year ?? 1,
          dorm: profile?.dorm ?? FALLBACK_DORM,
          classesTaken,
          majorClassesTaken
        }
      ]
    })
  )

  return { ...classDraft, characters }
}

/** The job half of the reply, keyed by charKey; kept out of the scheduler. */
export function jobAssignmentsOf(profiles: ProfileGenDraft): Record<string, JobAssignment> {
  const assignments: Record<string, JobAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    if (profile.job && profile.jobShifts > 0) {
      assignments[key] = { jobId: profile.job, count: profile.jobShifts }
    }
  }
  return assignments
}

/** The social half of the reply, keyed by charKey; kept out of the scheduler like the job. */
export function feedAssignmentsOf(profiles: ProfileGenDraft): Record<string, FeedAssignment> {
  const assignments: Record<string, FeedAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    assignments[key] = { handle: profile.handle, winterPosts: profile.winterPosts }
  }
  return assignments
}

/** What each of them does with spring break, keyed by charKey; blanks are omitted. */
export function springBreakAssignmentsOf(profiles: ProfileGenDraft): Record<string, string> {
  const assignments: Record<string, string> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    if (profile.springBreakPlans !== '') assignments[key] = profile.springBreakPlans
  }
  return assignments
}

/** The haunts half of the reply, keyed by charKey and resolved to location ids. */
export function hiddenScheduleAssignmentsOf(
  profiles: ProfileGenDraft
): Record<string, HiddenScheduleAssignment> {
  const assignments: Record<string, HiddenScheduleAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    const activityId = profile.activityLocation
      ? locationForKey(ACTIVITY_LOCATIONS, profile.activityLocation)
      : null
    assignments[key] = {
      homeSlots: profile.homeSlots,
      study: profile.study ? locationForKey(STUDY_LOCATIONS, profile.study) : null,
      fun: profile.fun.flatMap((entry) => {
        const id = locationForKey(FUN_LOCATIONS, entry)
        return id ? [id] : []
      }),
      activity: activityId ? { location: activityId, doing: profile.activity } : null,
      meal: profile.meal ? locationForKey(MEAL_LOCATIONS, profile.meal) : null
    }
  }
  return assignments
}
