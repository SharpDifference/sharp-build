import {
  charStartOf,
  CLASSES_PER_MAJOR,
  courseFilled,
  decidedFieldsOf,
  emptyGirl,
  isReturning,
  isSkipped,
  occasionFilled,
  POOL_SIZES,
  profileBlanks,
  profileFieldsOf,
  secretTiersBlank,
  startMilestonesOf,
  type ApplicationDraft,
  type ApplicationGirl,
  type BankedReply,
  type CatalogEntry,
  type CatalogPool,
  type DecidedProfile,
  type NewGameCall,
  type PlannedOccasion,
  type StartResult
} from '@shared/application'
import { SENIOR_YEAR } from '@shared/classes'
import { appError } from '@shared/errors'
import { fallbackHandleOf } from '@shared/feed'
import { pairsWithin } from '@shared/sceneCreator'
import { heldSecretsOf, SECRET_TIERS, secretText, secretTiersWanted } from '@shared/secrets'
import { intakeOf } from '@shared/semesters'
import { sha256Hex } from '@shared/sha256'
import {
  charKeyOf,
  type Character,
  type CharSecret,
  type Occasion,
  type SecretTier,
  type StructuredRequest
} from '@shared/types'
import {
  buildClassPrompt,
  dealtClassReply,
  decorateClasses,
  validateClassDraft,
  type ClassPromptInput,
  type ClassReply,
  type DealtClasses,
  type FilledCatalog
} from '../prompts/classPrompt'
import {
  buildOccasionPrompt,
  normalizeOccasions,
  occasionOf,
  type OccasionPromptInput
} from '../prompts/occasionPrompt'
import { fixedOccasionsOf, keptFixedEdits } from '../prompts/occasions'
import {
  buildProfilePrompt,
  decidedProfileOf,
  fallbackPursuit,
  feedAssignmentsOf,
  hiddenScheduleAssignmentsOf,
  jobAssignmentsOf,
  majorSpeller,
  mergeProfiles,
  normalizeActivity,
  springBreakAssignmentsOf,
  validateNextProfiles,
  validateProfileDraft,
  type ContinuedProfileReply,
  type NextProfileInput,
  type NextProfiles,
  type ProfileAcademics,
  type ProfileGenDraft,
  type ProfileGenReply,
  type ProfileValidation
} from '../prompts/profilePrompt'
import {
  buildSecretsPrompt,
  validateSecretDraft,
  type SecretsEntry,
  type SecretsReply
} from '../prompts/secretsPrompt'
import { buildSchedules } from './classScheduler'

/**
 * What New Game's calls ask for as an application stands, and the semester composed out of
 * their replies and the player's own values; pure, no IO.
 */

/** What every New Game request reads of the playthrough's setting and lorebook. */
export interface RequestWorld {
  setting: string
  book: readonly { text: string }[]
  /**
   * A later semester's graduates as the store holds them, in `continued.alumni` order, a deleted
   * one absent; absent on a first semester.
   */
  graduates?: readonly Character[]
}

/** One call's request as the application stands, ready to send and to check its reply against. */
export interface CallRequest {
  request: StructuredRequest
  key: string
  /** Refuses a reply that cannot be used, as an `AppError`. */
  check: (reply: unknown) => void
}

/**
 * What the skipped calls' blanks are filled with, dealt from the pools and rolled as the
 * semester is composed; only a skipped call's section is read.
 */
export interface SkipFill {
  /** By plan id. */
  occasions: Record<string, { title: string; description: string }>
  /** Every field the player left blank but her major, by charId. */
  profiles: Record<string, DecidedProfile>
  /** By charId, each tier she left blank, or a returning girl's new ones. */
  secrets: Record<string, Partial<Record<SecretTier, string>>>
  classes?: DealtClasses
  /** By charId, each girl who graduated at the last ending without the player's words for her. */
  pursuits: Record<string, string>
  /** By charId, each returning girl's before a spring. */
  springBreakPlans: Record<string, string>
}

/**
 * What a call needs now: nothing, since nothing is left to generate; to wait, the class call
 * while a major is still unknown; or a request.
 */
export type CallNeed = 'none' | 'waiting' | CallRequest

/** The hash a request is banked under: of its system, user and schema. */
function keyOf(request: StructuredRequest): string {
  return sha256Hex(JSON.stringify([request.system, request.user, request.schema]))
}

/** A roster girl's prompt identity. */
function charKey(character: Character): string {
  return charKeyOf(character.firstName, character.lastName)
}

/** Everything the player set for one girl, or nothing. */
function girlOf(draft: ApplicationDraft, charId: string): ApplicationGirl {
  return draft.girls[charId] ?? emptyGirl()
}

/**
 * The roster split into the girls new to the playthrough and those returning from the last
 * semester, each in roster order; on a first semester every girl is new.
 */
function splitRoster(
  draft: ApplicationDraft,
  roster: readonly Character[]
): { newcomers: Character[]; returning: Character[] } {
  const newcomers: Character[] = []
  const returning: Character[] = []
  for (const character of roster) {
    if (isReturning(draft, character.charId)) returning.push(character)
    else newcomers.push(character)
  }
  return { newcomers, returning }
}

/** A returning girl's major as the last semester spelt it; undefined for anybody else. */
function priorMajorOf(draft: ApplicationDraft, charId: string): string | undefined {
  if (!isReturning(draft, charId)) return undefined
  return draft.continued?.priorProfiles[charId]?.major ?? ''
}

/** The returning girls' majors in roster order, which every other major is spelt after. */
function returningMajorsOf(draft: ApplicationDraft, roster: readonly Character[]): string[] {
  return roster.flatMap((c) => {
    const major = priorMajorOf(draft, c.charId)
    return major === undefined ? [] : [major]
  })
}

/**
 * How a profile reply is validated: every major spelt after the returning ones, and on a later
 * semester no break posts, nor spring break plans before a fall.
 */
function validationOf(draft: ApplicationDraft, roster: readonly Character[]): ProfileValidation {
  return {
    knownMajors: returningMajorsOf(draft, roster),
    posts: !draft.continued,
    plans: !draft.continued || draft.season === 'spring'
  }
}

/**
 * What a later semester's profile call asks beyond its new students: the returning girls' break
 * and the life since of every graduate with a profile to read; none on a first semester.
 */
function nextInputOf(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): NextProfileInput | undefined {
  const continued = draft.continued
  if (!continued) return undefined
  const graduates = (world.graduates ?? []).flatMap((character) => {
    const prior = continued.priorProfiles[character.charId]
    if (!prior) return []
    const decided = continued.graduated.includes(character.charId)
      ? (draft.pursuits?.[character.charId]?.trim() ?? '')
      : ''
    return [
      {
        character,
        major: prior.major,
        ...(prior.pursuing ? { pursuing: prior.pursuing } : {}),
        ...(decided ? { decided } : {})
      }
    ]
  })
  return { season: draft.season, returning: splitRoster(draft, roster).returning, graduates }
}

/** The occasion call's input: the planned occasions nobody has written, beside those somebody has. */
function occasionInput(draft: ApplicationDraft, world: RequestWorld): OccasionPromptInput {
  const asked: PlannedOccasion[] = []
  const written: Occasion[] = []
  for (const planned of draft.plan) {
    const entry = draft.occasions[planned.id]
    if (occasionFilled(entry)) written.push(occasionOf(planned, entry))
    else asked.push(planned)
  }
  return {
    season: draft.season,
    asked,
    written,
    fixed: fixedOccasionsOf(draft.season, draft.fixedEdits ?? {}),
    setting: world.setting,
    book: world.book
  }
}

/** What the occasions call needs. */
function occasionNeed(draft: ApplicationDraft, world: RequestWorld): CallNeed {
  const input = occasionInput(draft, world)
  if (input.asked.length === 0) return 'none'
  const request = buildOccasionPrompt(input)
  return {
    request,
    key: keyOf(request),
    check: (reply) => {
      if (normalizeOccasions(reply, input.asked).length > 0) return
      throw appError(
        'OCCASION_GEN_INVALID',
        'The semester’s occasions came back empty.',
        `${input.asked.length} were asked for; none could be written.`
      )
    }
  }
}

/**
 * The profile call's input for the girls new to the playthrough, with whom it asks and what it
 * validates against; a returning girl's major is one the others may share.
 */
function profileInput(
  draft: ApplicationDraft,
  roster: readonly Character[]
): {
  newcomers: Character[]
  decided: Record<string, ReturnType<typeof decidedProfileOf>>
  asked: Set<string>
  students: { character: Character; decided: ReturnType<typeof decidedProfileOf> }[]
  otherMajors: string[]
} {
  const { newcomers } = splitRoster(draft, roster)
  const fields = profileFieldsOf(draft)
  const decided: Record<string, ReturnType<typeof decidedProfileOf>> = {}
  const asked = new Set<string>()
  const students: { character: Character; decided: ReturnType<typeof decidedProfileOf> }[] = []
  const otherMajors = new Set<string>(returningMajorsOf(draft, roster))
  for (const character of newcomers) {
    const key = charKey(character)
    const profile = girlOf(draft, character.charId).profile
    decided[key] = decidedProfileOf(profile, fields)
    if (profileBlanks(profile, fields).length > 0) {
      asked.add(key)
      students.push({ character, decided: decided[key] })
    } else if (decided[key].major) otherMajors.add(decided[key].major)
  }
  return { newcomers, decided, asked, students, otherMajors: [...otherMajors] }
}

/** What the profile call needs. */
function profileNeed(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): CallNeed {
  const input = profileInput(draft, roster)
  const next = nextInputOf(draft, roster, world)
  const request = buildProfilePrompt({
    students: input.students,
    otherMajors: input.otherMajors,
    ...(next ? { next } : {}),
    setting: world.setting
  })
  if (!request) return 'none'
  const validation = validationOf(draft, roster)
  return {
    request,
    key: keyOf(request),
    check: (reply) => {
      validateProfileDraft(
        reply as ProfileGenReply,
        input.newcomers,
        input.decided,
        input.asked,
        validation
      )
      if (next) validateNextProfiles(reply as ContinuedProfileReply, next)
    }
  }
}

/**
 * The secrets call's entries: every new girl with a tier left, her written ones held, and every
 * returning girl the tiers she is owed, what she carries held.
 */
function secretEntries(draft: ApplicationDraft, roster: readonly Character[]): SecretsEntry[] {
  return roster.flatMap((character) => {
    if (isReturning(draft, character.charId)) {
      const carried = draft.continued?.carry.charInfo[character.charId]
      return [
        {
          character,
          tiers: secretTiersWanted(carried),
          held: heldSecretsOf(carried),
          ...(carried?.flags?.hadSex ? { hadSex: true } : {})
        }
      ]
    }
    const girl = girlOf(draft, character.charId)
    const tiers = secretTiersBlank(girl.secrets)
    if (tiers.length === 0) return []
    const held = SECRET_TIERS.flatMap((tier) => {
      const text = girl.secrets[tier]?.trim()
      return text ? [secretText(text)] : []
    })
    const hadSex = startMilestonesOf(girl, character).sex
    return [{ character, tiers, held, ...(hadSex ? { hadSex: true } : {}) }]
  })
}

/** What the secrets call needs. */
function secretNeed(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): CallNeed {
  const entries = secretEntries(draft, roster)
  if (entries.length === 0) return 'none'
  const request = buildSecretsPrompt(entries, world.setting)
  return {
    request,
    key: keyOf(request),
    check: (reply) => {
      validateSecretDraft(reply as SecretsReply, entries)
    }
  }
}

/** Whether a banked reply still answers a call's need. */
export function bankAnswers(banked: BankedReply | undefined, need: CallNeed): boolean {
  if (!banked || typeof need === 'string') return false
  return banked.key === need.key
}

/**
 * The new girls' profiles as they stand: decided alone where nothing was left to write, else the
 * banked reply laid under the decided fields; null while that reply is not in.
 */
function profilesOf(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): ProfileGenDraft | null {
  const need = profileNeed(draft, roster, world)
  const input = profileInput(draft, roster)
  const validation = validationOf(draft, roster)
  if (need === 'none') {
    return validateProfileDraft(undefined, input.newcomers, input.decided, new Set(), validation)
  }
  const banked = draft.replies.profiles
  if (!bankAnswers(banked, need)) return null
  return validateProfileDraft(
    banked?.reply as ProfileGenReply,
    input.newcomers,
    input.decided,
    input.asked,
    validation
  )
}

/**
 * Every roster girl's major by charId: a returning girl's as last semester spelt it, a new girl's
 * as decided or as the profile reply wrote it; null while one is still unknown.
 */
export function majorsOf(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): Record<string, string> | null {
  if (isSkipped(draft, 'profiles')) return skippedMajorsOf(draft, roster)
  const profiles = profilesOf(draft, roster, world)
  if (profiles) {
    return Object.fromEntries(
      roster.map((c) => [
        c.charId,
        priorMajorOf(draft, c.charId) ?? profiles.characters[charKey(c)]?.major ?? ''
      ])
    )
  }
  // Every major decided: read as the profile call's validation would spell them.
  const spell = majorSpeller()
  for (const major of returningMajorsOf(draft, roster)) spell(major)
  const decided = roster.map(
    (c) => priorMajorOf(draft, c.charId) ?? spell(girlOf(draft, c.charId).profile.major)
  )
  if (decided.some((major) => major === '')) return null
  return Object.fromEntries(roster.map((c, index) => [c.charId, decided[index]]))
}

/**
 * Every roster girl's major by charId where profiles are skipped: a returning girl's as last
 * semester spelt it, a new girl's as she wrote it, else the one dealt to her, read as the profile
 * validation spells them — every returning major first, then every one she wrote, in roster
 * order — so the class call and the composition agree. Null while one is missing.
 */
function skippedMajorsOf(
  draft: ApplicationDraft,
  roster: readonly Character[]
): Record<string, string> | null {
  const spell = majorSpeller()
  for (const major of returningMajorsOf(draft, roster)) spell(major)
  for (const c of roster) {
    if (!isReturning(draft, c.charId)) spell(girlOf(draft, c.charId).profile.major)
  }
  const majors: Record<string, string> = {}
  for (const c of roster) {
    const major =
      priorMajorOf(draft, c.charId) ??
      (spell(girlOf(draft, c.charId).profile.major) || spell(draft.dealtMajors?.[c.charId]))
    if (major === '') return null
    majors[c.charId] = major
  }
  return majors
}

/** The class call's input, once every major is known. */
export function classInput(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld,
  majors: Record<string, string>
): ClassPromptInput {
  const known = new Set(Object.values(majors))
  /** A pool's whole entries, no more than it holds. */
  const whole = (pool: CatalogPool): CatalogEntry[] =>
    draft.catalog[pool]
      .filter((entry) => courseFilled(entry, pool === 'pe'))
      .slice(0, POOL_SIZES[pool])
  const filled: FilledCatalog = {
    pe: whole('pe'),
    humanities: whole('humanities'),
    arts: whole('arts'),
    misc: whole('misc'),
    major: Object.fromEntries(
      Object.entries(draft.catalog.major)
        .filter(([major]) => known.has(major))
        .map(([major, entries]) => [
          major,
          entries.filter((entry) => courseFilled(entry, false)).slice(0, CLASSES_PER_MAJOR)
        ])
    )
  }
  return {
    students: roster.map((character) => {
      const interest = draft.catalog.interest[character.charId]
      return {
        character,
        major: majors[character.charId],
        ...(courseFilled(interest, false) ? { interest } : {})
      }
    }),
    filled,
    ...(draft.continued ? { taken: draft.continued.taken } : {}),
    setting: world.setting
  }
}

/** What the class call needs. */
function classNeed(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): CallNeed {
  const majors = majorsOf(draft, roster, world)
  if (!majors) return 'waiting'
  const input = classInput(draft, roster, world, majors)
  const request = buildClassPrompt(input)
  if (!request) return 'none'
  return {
    request,
    key: keyOf(request),
    check: (reply) => {
      validateClassDraft(reply as ClassReply, input)
    }
  }
}

/**
 * What one call needs as the application stands. A skipped call needs nothing sent, though a
 * skipped catalog still waits on the majors it is dealt around.
 */
export function needOf(
  call: NewGameCall,
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): CallNeed {
  if (isSkipped(draft, call)) {
    return call === 'classes' && !majorsOf(draft, roster, world) ? 'waiting' : 'none'
  }
  switch (call) {
    case 'occasions':
      return occasionNeed(draft, world)
    case 'profiles':
      return profileNeed(draft, roster, world)
    case 'secrets':
      return secretNeed(draft, roster, world)
    case 'classes':
      return classNeed(draft, roster, world)
  }
}

/** Raised where a reply the composition needs is not banked. */
function unanswered(call: NewGameCall): never {
  throw appError('NEW_GAME_INCOMPLETE', 'New Game is still waiting on a reply.', `${call} is not in.`)
}

/** A banked reply, where it still answers its call; `undefined` where the call needs none. */
function answered(
  call: NewGameCall,
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld
): { need: CallNeed; reply: unknown } {
  const need = needOf(call, draft, roster, world)
  if (need === 'none') return { need, reply: undefined }
  if (need === 'waiting' || !bankAnswers(draft.replies[call], need)) unanswered(call)
  return { need, reply: draft.replies[call]?.reply }
}

/** Where a skipped call's fill is needed and the composition was handed none. */
function unfilled(call: NewGameCall): never {
  throw appError('NEW_GAME_INCOMPLETE', 'New Game is still waiting on a reply.', `${call} was not filled.`)
}

/**
 * The new girls' skipped profiles: every field she decided, the fill's for the rest, and the
 * major {@link skippedMajorsOf} reads; refused rather than clamped where a field is still blank.
 */
function skippedProfilesOf(
  draft: ApplicationDraft,
  roster: readonly Character[],
  fill: SkipFill | undefined
): ProfileGenDraft {
  const majors = skippedMajorsOf(draft, roster) ?? unfilled('profiles')
  const { newcomers } = splitRoster(draft, roster)
  const fields = profileFieldsOf(draft)
  const decided: Record<string, ReturnType<typeof decidedProfileOf>> = {}
  for (const character of newcomers) {
    const profile: DecidedProfile = {
      ...fill?.profiles[character.charId],
      ...decidedFieldsOf(girlOf(draft, character.charId).profile, fields),
      major: majors[character.charId]
    }
    const blanks = profileBlanks(profile, fields).filter(
      (field) => field !== 'springBreakPlans' || draft.season === 'spring'
    )
    if (blanks.length > 0) unfilled('profiles')
    decided[charKey(character)] = decidedProfileOf(profile, fields)
  }
  return validateProfileDraft(undefined, newcomers, decided, new Set(), validationOf(draft, roster))
}

/**
 * Each returning girl's academics as the last semester leaves them, by charKey: her year, dorm
 * and major, as many classes as she took, held to three to six, and as many in her major as she
 * took, held to one to three and to her load.
 */
function returningAcademicsOf(
  draft: ApplicationDraft,
  returning: readonly Character[]
): Record<string, ProfileAcademics> {
  const out: Record<string, ProfileAcademics> = {}
  for (const character of returning) {
    const prior = draft.continued?.priorProfiles[character.charId]
    if (!prior) continue
    const load = new Set(Object.values(prior.schedule)).size
    const classesTaken = load === 0 ? 4 : Math.min(6, Math.max(3, load))
    const inMajor = draft.continued?.majorLoads[character.charId] ?? 1
    out[charKey(character)] = {
      year: prior.year,
      dorm: prior.dorm,
      major: prior.major,
      classesTaken,
      majorClassesTaken: Math.min(Math.min(3, classesTaken), Math.max(1, inMajor))
    }
  }
  return out
}

/**
 * The semester out of the banked replies and everything the player wrote, the player's values
 * winning: today's composition of the four calls, run once every call needed has answered. A
 * skipped call reads `fill` in place of a reply. A later semester keeps what its returning girls
 * carry, says what its graduates are doing now, and before a fall picks its early graduate with
 * `rand`.
 */
export function composeApplication(
  draft: ApplicationDraft,
  roster: readonly Character[],
  world: RequestWorld,
  fill?: SkipFill,
  rand: () => number = Math.random
): StartResult {
  // Occasions: the player's where whole, the fill's or the reply's for the rest, in plan order.
  const generated = new Map<string, Occasion>()
  if (isSkipped(draft, 'occasions')) {
    for (const planned of draft.plan) {
      const words = fill?.occasions[planned.id]
      if (words) generated.set(planned.id, occasionOf(planned, words))
    }
  } else {
    const occasionReply = answered('occasions', draft, roster, world)
    if (occasionReply.need !== 'none') {
      for (const occasion of normalizeOccasions(occasionReply.reply, occasionInput(draft, world).asked)) {
        generated.set(occasion.id, occasion)
      }
    }
  }
  const occasions = draft.plan.flatMap((planned) => {
    const entry = draft.occasions[planned.id]
    if (occasionFilled(entry)) return [occasionOf(planned, entry)]
    const written = generated.get(planned.id)
    if (!written) console.warn(`[newGame] ${planned.id} was left unwritten; dropping it.`)
    return written ? [written] : []
  })

  const continued = draft.continued
  const { returning } = splitRoster(draft, roster)
  const next = nextInputOf(draft, roster, world)
  let profiles: ProfileGenDraft
  // What a later semester's reply says of its returning girls and graduates, where it was asked.
  let nextProfiles: NextProfiles | undefined
  if (isSkipped(draft, 'profiles')) {
    profiles = skippedProfilesOf(draft, roster, fill)
  } else {
    const profileReply = answered('profiles', draft, roster, world)
    profiles = profilesOf(draft, roster, world) ?? unanswered('profiles')
    if (next && profileReply.need !== 'none') {
      nextProfiles = validateNextProfiles(profileReply.reply as ContinuedProfileReply, next)
    }
  }

  const majors = majorsOf(draft, roster, world) ?? unanswered('classes')
  const input = classInput(draft, roster, world, majors)
  const catalog = isSkipped(draft, 'classes')
    ? validateClassDraft(dealtClassReply(fill?.classes ?? unfilled('classes'), input.students), {
        ...input,
        openMajors: true
      })
    : validateClassDraft(answered('classes', draft, roster, world).reply as ClassReply | undefined, input)
  const academics = { ...profiles.characters, ...returningAcademicsOf(draft, returning) }
  const schedules = buildSchedules(
    decorateClasses(mergeProfiles(catalog, { characters: academics })),
    roster
  )

  // Secrets: the player's tiers where written, the fill's or the reply's for the rest, lowest first.
  let written: Record<string, CharSecret[]> = {}
  if (isSkipped(draft, 'secrets')) {
    written = Object.fromEntries(
      roster.map((character) => [
        charKey(character),
        SECRET_TIERS.flatMap((tier): CharSecret[] => {
          const text = fill?.secrets[character.charId]?.[tier]
          return text ? [{ text: secretText(text), tier }] : []
        })
      ])
    )
  } else {
    const secretReply = answered('secrets', draft, roster, world)
    if (secretReply.need !== 'none') {
      written = validateSecretDraft(secretReply.reply as SecretsReply, secretEntries(draft, roster))
    }
  }
  const secrets: Record<string, CharSecret[]> = {}
  for (const character of roster) {
    // A returning girl's words are never the player's: hers are only the new ones.
    const girl = isReturning(draft, character.charId)
      ? emptyGirl()
      : girlOf(draft, character.charId)
    const theirs = written[charKey(character)] ?? []
    const held = SECRET_TIERS.flatMap((tier): CharSecret[] => {
      const text = girl.secrets[tier]?.trim()
      return text
        ? [{ text: secretText(text), tier }]
        : theirs.filter((secret) => secret.tier === tier)
    })
    if (held.length > 0) secrets[character.charId] = held
  }

  /** One profile assignment map re-keyed from charKey to charId, absences dropped. */
  const byCharId = <T,>(byKey: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      roster
        .map((c) => [c.charId, byKey[charKey(c)]] as const)
        .filter(([, assignment]) => Boolean(assignment))
    ) as Record<string, T>

  const jobs = byCharId(jobAssignmentsOf(profiles))
  const haunts = byCharId(hiddenScheduleAssignmentsOf(profiles))
  const feeds = byCharId(feedAssignmentsOf(profiles))
  const springBreakPlans = byCharId(springBreakAssignmentsOf(profiles))
  let later: Pick<StartResult, 'pursuits' | 'fallGraduate'> = {}
  if (continued) {
    const skipped = isSkipped(draft, 'profiles')
    const graduates = world.graduates ?? []
    // Handles stay as they were; the posts are the break's.
    for (const character of [...returning, ...graduates]) {
      const prior = continued.priorProfiles[character.charId]
      if (!prior) continue
      feeds[character.charId] = {
        handle: prior.handle ?? fallbackHandleOf(character.firstName, character.lastName),
        winterPosts: nextProfiles?.breakPosts[charKey(character)] ?? []
      }
    }
    // A returning girl keeps her employer and her habits, and is asked her spring break alone.
    for (const character of returning) {
      const job = continued.jobs[character.charId]
      if (job) jobs[character.charId] = job
      const haunt = continued.haunts[character.charId]
      if (haunt) haunts[character.charId] = haunt
      const plans = skipped
        ? fill?.springBreakPlans[character.charId]
        : nextProfiles?.springBreakPlans[charKey(character)]
      if (draft.season === 'spring' && plans) springBreakPlans[character.charId] = plans
    }

    // A graduate's life since: the player's for one who just graduated, else the reply's or the
    // fill's, else last semester's.
    const pursuits: Record<string, string> = {}
    for (const character of graduates) {
      const prior = continued.priorProfiles[character.charId]
      const decided = continued.graduated.includes(character.charId)
        ? normalizeActivity(draft.pursuits?.[character.charId])
        : ''
      const generated = skipped
        ? fill?.pursuits[character.charId]
        : nextProfiles?.pursuits[charKey(character)]
      pursuits[character.charId] = decided || generated || fallbackPursuit(prior?.pursuing)
    }

    // A fall's early graduate: one of its returning seniors from the August intake.
    const seniors = returning.filter((character) => {
      const prior = continued.priorProfiles[character.charId]
      return prior !== undefined && prior.year >= SENIOR_YEAR && intakeOf(prior) === 'fall'
    })
    const fallGraduate =
      draft.season === 'fall' && seniors.length > 0
        ? seniors[Math.floor(rand() * seniors.length)].charId
        : undefined
    later = { pursuits, ...(fallGraduate ? { fallGraduate } : {}) }
  }

  return {
    schedules,
    jobs,
    haunts,
    feeds,
    springBreakPlans,
    occasions,
    fixedEdits: keptFixedEdits(draft.season, draft.fixedEdits ?? {}),
    secrets,
    starts: Object.fromEntries(
      roster.flatMap((c) => {
        const start = charStartOf(draft.girls[c.charId], c)
        return start ? [[c.charId, start] as const] : []
      })
    ),
    pairs: pairsWithin(
      roster.map((c) => c.charId),
      draft.pairs
    ),
    ...later
  }
}
