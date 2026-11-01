import {
  isReturning,
  yearFloorOf,
  type ApplicationDraft,
  type FinalClassEdit,
  type FinalEdits,
  type FinalGirlEdit,
  type FinalOccasionEdit,
  type StartResult
} from '@shared/application'
import { isCourse } from '@shared/academics'
import { SECRET_TIERS, secretText } from '@shared/secrets'
import type {
  CharSchedule,
  CharSecret,
  ClassEntry,
  FeedAssignment,
  HiddenScheduleAssignment,
  JobAssignment,
  SecretTier
} from '@shared/types'
import { activityPhraseAt, normalizeActivity, normalizeHandle } from '../prompts/profilePrompt'

/**
 * What the Finalize screen may change of the semester Loading composed, which of the player's
 * changes can be kept, and the semester with them laid over; pure, no IO.
 */

/** Who a girl on Finalize is: new to the roster, returning from the last semester, or graduated. */
export type FinalGirlKind = 'newcomer' | 'returning' | 'graduate'

/** Something on Finalize to undo the changes of: an occasion, a class, a major or a girl. */
export type FinalTarget =
  | { occasion: string }
  | { class: string }
  | { major: string }
  | { girl: string }

/** A change that cannot be kept as it stands, so the composed value stands in its place. */
export type FinalFault =
  | { kind: 'code'; code: string; why: 'repeated' | 'taken' }
  | { kind: 'major'; major: string }
  | { kind: 'handle' | 'job' | 'activity'; charId: string }

/** One major of the composed semester, and whether Finalize may rename it. */
export interface FinalMajor {
  name: string
  /** False where a returning girl holds it, her major being last semester's. */
  renamable: boolean
}

/** What Finalize has changed, item by item, as the semester will be written. */
export interface FinalChanges {
  occasions: Set<string>
  classes: Set<string>
  majors: Set<string>
  girls: Set<string>
}

/** Text as it is kept: trimmed, or undefined where its box was cleared or never typed in. */
function words(text: string | undefined): string | undefined {
  const trimmed = text?.trim()
  return trimmed ? trimmed : undefined
}

/** A major's name with its spacing tidied. */
function majorName(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Two majors are one where they differ only in case or spacing. */
function majorKey(text: string): string {
  return majorName(text).toLowerCase()
}

/** Whether two values say the same thing. */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The composed semester, which every caller here is only reached with. */
function composedOf(draft: ApplicationDraft): StartResult {
  if (!draft.composed) throw new Error('Finalize has no composed semester.')
  return draft.composed
}

/** Who a girl is on Finalize, or null for a charId it holds nothing of. */
export function finalGirlKindOf(draft: ApplicationDraft, charId: string): FinalGirlKind | null {
  if (draft.chars.includes(charId)) return isReturning(draft, charId) ? 'returning' : 'newcomer'
  return draft.composed?.pursuits?.[charId] !== undefined ? 'graduate' : null
}

/** Every major the composed semester holds, alphabetical. */
export function finalMajorsOf(draft: ApplicationDraft): FinalMajor[] {
  const composed = composedOf(draft)
  const held = new Map<string, boolean>()
  for (const charId of draft.chars) {
    const major = composed.schedules.perChar[charId]?.major
    if (!major) continue
    held.set(major, (held.get(major) ?? true) && !isReturning(draft, charId))
  }
  for (const entry of Object.values(composed.schedules.classes)) {
    if (entry.major && !held.has(entry.major)) held.set(entry.major, true)
  }
  return [...held.entries()]
    .map(([name, renamable]) => ({ name, renamable }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Her secret of one tier as composed, or undefined. */
function secretOf(composed: StartResult, charId: string, tier: SecretTier): string | undefined {
  return composed.secrets[charId]?.find((secret) => secret.tier === tier)?.text
}

/** Her job as composed, null for none. */
function jobOf(composed: StartResult, charId: string): { jobId: string; count: number } | null {
  const job = composed.jobs[charId]
  return job ? { jobId: job.jobId, count: job.count } : null
}

/** A record with `key`'s entry replaced, dropped where it is empty; undefined once nothing is left. */
function withEntry<T extends object>(
  record: Record<string, T> | undefined,
  key: string,
  entry: T | undefined
): Record<string, T> | undefined {
  const { [key]: _dropped, ...rest } = record ?? {}
  const next: Record<string, T> =
    entry !== undefined && Object.keys(entry).length > 0 ? { ...rest, [key]: entry } : rest
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1)))
  return Object.keys(sorted).length > 0 ? sorted : undefined
}

/** The draft with one section of its edits replaced, or the same draft where nothing changes. */
function withSection<K extends keyof FinalEdits>(
  draft: ApplicationDraft,
  section: K,
  value: FinalEdits[K]
): ApplicationDraft {
  const before = draft.finalEdits ?? {}
  if (same(before[section], value)) return draft
  const { [section]: _dropped, ...others } = before
  const edits: FinalEdits = value !== undefined ? { ...others, [section]: value } : others
  const { finalEdits: _old, ...rest } = draft
  return Object.keys(edits).length > 0 ? { ...rest, finalEdits: edits } : rest
}

/**
 * The draft with `patch` laid over one invented occasion's words as they are typed: a field equal
 * to the composed one dropped, a cleared one kept so its box stays empty.
 */
export function withFinalOccasion(
  draft: ApplicationDraft,
  id: string,
  patch: FinalOccasionEdit
): ApplicationDraft {
  const occasion = composedOf(draft).occasions.find((entry) => entry.id === id)
  if (!occasion) return draft
  const next: FinalOccasionEdit = { ...draft.finalEdits?.occasions?.[id], ...patch }
  if (next.title === undefined || next.title === occasion.title) delete next.title
  if (next.description === undefined || next.description === occasion.description) {
    delete next.description
  }
  return withSection(draft, 'occasions', withEntry(draft.finalEdits?.occasions, id, next))
}

/** The draft with `patch` laid over one class's fields as they are typed or picked. */
export function withFinalClass(
  draft: ApplicationDraft,
  code: string,
  patch: FinalClassEdit
): ApplicationDraft {
  const entry = composedOf(draft).schedules.classes[code]
  if (!entry) return draft
  const next: FinalClassEdit = { ...draft.finalEdits?.classes?.[code], ...patch }
  if (next.code === undefined || next.code === entry.code) delete next.code
  if (next.name === undefined || next.name === entry.name) delete next.name
  if (next.description === undefined || next.description === entry.description) {
    delete next.description
  }
  if (next.kind === undefined || !isCourse(entry) || next.kind === entry.kind) delete next.kind
  return withSection(draft, 'classes', withEntry(draft.finalEdits?.classes, code, next))
}

/** The draft with one major's name as it is typed, its own name dropped. */
export function withFinalMajor(draft: ApplicationDraft, major: string, name: string): ApplicationDraft {
  const { [major]: _dropped, ...rest } = draft.finalEdits?.majors ?? {}
  const majors = name === major ? rest : { ...rest, [major]: name }
  const sorted = Object.fromEntries(Object.entries(majors).sort(([a], [b]) => (a < b ? -1 : 1)))
  return withSection(draft, 'majors', Object.keys(sorted).length > 0 ? sorted : undefined)
}

/**
 * The draft with `patch` laid over one girl's changes as they are typed or picked, each field
 * equal to the composed one dropped — a post or a secret by its own box, the activity as its
 * place and phrase together — and a cleared box kept.
 */
export function withFinalGirl(
  draft: ApplicationDraft,
  charId: string,
  patch: FinalGirlEdit
): ApplicationDraft {
  const composed = composedOf(draft)
  const next: FinalGirlEdit = { ...draft.finalEdits?.girls?.[charId], ...patch }
  const haunts = composed.haunts[charId]
  const drop = (field: keyof FinalGirlEdit, value: unknown): void => {
    if (next[field] === undefined || same(next[field], value)) delete next[field]
  }
  drop('dorm', composed.schedules.perChar[charId]?.dorm)
  drop('homeSlots', haunts?.homeSlots)
  drop('job', jobOf(composed, charId))
  drop('study', haunts?.study)
  drop('meal', haunts?.meal)
  drop('fun', haunts?.fun)
  drop('handle', composed.feeds[charId]?.handle)
  drop('springBreakPlans', composed.springBreakPlans[charId] ?? '')
  drop('pursuit', composed.pursuits?.[charId])
  drop('activity', haunts?.activity ?? null)
  if (next.posts) {
    const posts = composed.feeds[charId]?.winterPosts ?? []
    const kept = Object.fromEntries(
      Object.entries(next.posts).filter(([index, text]) => text !== posts[Number(index)])
    )
    if (Object.keys(kept).length > 0) next.posts = kept
    else delete next.posts
  }
  if (next.secrets) {
    const kept: Partial<Record<SecretTier, string>> = {}
    for (const tier of SECRET_TIERS) {
      const text = next.secrets[tier]
      if (text !== undefined && text !== secretOf(composed, charId, tier)) kept[tier] = text
    }
    if (Object.keys(kept).length > 0) next.secrets = kept
    else delete next.secrets
  }
  return withSection(draft, 'girls', withEntry(draft.finalEdits?.girls, charId, next))
}

/** The draft with every change to one occasion, class, major or girl put back. */
export function withoutFinalEdits(draft: ApplicationDraft, target: FinalTarget): ApplicationDraft {
  const edits = draft.finalEdits
  if ('occasion' in target) {
    return withSection(draft, 'occasions', withEntry(edits?.occasions, target.occasion, undefined))
  }
  if ('class' in target) {
    return withSection(draft, 'classes', withEntry(edits?.classes, target.class, undefined))
  }
  if ('major' in target) return withFinalMajor(draft, target.major, target.major)
  return withSection(draft, 'girls', withEntry(edits?.girls, target.girl, undefined))
}

/** Whether one occasion, class, major or girl holds any change at all, a cleared box included. */
export function finalTouched(draft: ApplicationDraft, target: FinalTarget): boolean {
  const edits = draft.finalEdits
  if ('occasion' in target) return edits?.occasions?.[target.occasion] !== undefined
  if ('class' in target) return edits?.classes?.[target.class] !== undefined
  if ('major' in target) return edits?.majors?.[target.major] !== undefined
  return edits?.girls?.[target.girl] !== undefined
}

/**
 * Every change that cannot be kept as it stands: a class code another class has, composed or as
 * changed, or that an earlier semester ran; a major named as another major is or is renamed to,
 * case and spacing aside; a handle with no letter; a job without its shifts; and an activity at a
 * new place with no phrase written for it.
 */
export function finalFaultsOf(draft: ApplicationDraft): FinalFault[] {
  const composed = composedOf(draft)
  const edits = draft.finalEdits ?? {}
  const faults: FinalFault[] = []

  const taken = new Set((draft.continued?.taken ?? []).map((entry) => entry.code))
  const codes = Object.keys(composed.schedules.classes)
  const typed = new Map<string, string>()
  for (const code of codes) {
    const next = words(edits.classes?.[code]?.code)
    if (next !== undefined) typed.set(code, next)
  }
  for (const [code, next] of typed) {
    const clash =
      codes.some((other) => other !== code && other === next) ||
      [...typed].some(([other, theirs]) => other !== code && theirs === next)
    if (clash) faults.push({ kind: 'code', code, why: 'repeated' })
    else if (taken.has(next)) faults.push({ kind: 'code', code, why: 'taken' })
  }

  const majors = finalMajorsOf(draft)
  for (const { name, renamable } of majors) {
    const next = words(edits.majors?.[name])
    if (!renamable || next === undefined) continue
    const clash = majors.some((other) => {
      if (other.name === name) return false
      const theirs = words(edits.majors?.[other.name]) ?? other.name
      return majorKey(other.name) === majorKey(next) || majorKey(theirs) === majorKey(next)
    })
    if (clash) faults.push({ kind: 'major', major: name })
  }

  for (const charId of draft.chars) {
    if (isReturning(draft, charId)) continue
    const edit = edits.girls?.[charId]
    if (!edit) continue
    const handle = words(edit.handle)
    if (handle !== undefined && normalizeHandle(handle) === '') faults.push({ kind: 'handle', charId })
    if (edit.job && (!edit.job.jobId || edit.job.count === undefined)) {
      faults.push({ kind: 'job', charId })
    }
    // A cleared phrase at her composed place keeps the composed one; at a new place it says nothing.
    const activity = edit.activity
    const moved = activity && activity.location !== draft.composed?.haunts[charId]?.activity?.location
    if (
      activity &&
      (!activity.location || (moved && activityPhraseAt(activity.doing, activity.location) === ''))
    ) {
      faults.push({ kind: 'activity', charId })
    }
  }
  return faults
}

/** Her edited break posts laid over the composed ones, each post blank in its box kept as it was. */
function postsOf(feed: FeedAssignment, edit: FinalGirlEdit | undefined): FeedAssignment {
  if (!edit?.posts) return feed
  return {
    ...feed,
    winterPosts: feed.winterPosts.map((post, index) => words(edit.posts?.[String(index)]) ?? post)
  }
}

/** Her secrets with each edited tier laid over, worded as a reply's are. */
function secretsOf(held: readonly CharSecret[], edit: FinalGirlEdit | undefined): CharSecret[] {
  return held.map((secret) => {
    const text = words(edit?.secrets?.[secret.tier])
    return text !== undefined ? { ...secret, text: secretText(text) } : secret
  })
}

/** Her haunts with every edited choice laid over, the activity's phrase repaired for its place. */
function hauntsOf(
  haunts: HiddenScheduleAssignment,
  edit: FinalGirlEdit,
  activityKept: boolean
): HiddenScheduleAssignment {
  const next: HiddenScheduleAssignment = { ...haunts }
  if (edit.homeSlots !== undefined) next.homeSlots = edit.homeSlots
  if (edit.study !== undefined) next.study = edit.study
  if (edit.meal !== undefined) next.meal = edit.meal
  if (edit.fun !== undefined) next.fun = [...edit.fun]
  const activity = edit.activity
  if (activity === null) next.activity = null
  else if (activity && activityKept && activity.location) {
    const before = haunts.activity
    const doing =
      words(activity.doing) === undefined && before?.location === activity.location
        ? before.doing
        : activityPhraseAt(activity.doing, activity.location)
    next.activity = { location: activity.location, doing }
  }
  return next
}

/** The semester with the kept changes laid over, and the majors and codes they renamed. */
interface LaidOver {
  semester: StartResult
  /** Each major renamed, by its composed name. */
  renamed: ReadonlyMap<string, string>
  /** Each class given a new code, by its composed code. */
  recoded: ReadonlyMap<string, string>
}

/** {@link finalizedOf}, with the renames it made. */
function layOver(draft: ApplicationDraft): LaidOver {
  const composed = composedOf(draft)
  const edits = draft.finalEdits
  if (!edits) return { semester: composed, renamed: new Map(), recoded: new Map() }
  const faults = finalFaultsOf(draft)
  const faulted = (kind: FinalFault['kind'], key: string): boolean =>
    faults.some((fault) =>
      fault.kind === 'code' ? kind === 'code' && fault.code === key
        : fault.kind === 'major' ? kind === 'major' && fault.major === key
          : fault.kind === kind && fault.charId === key
    )

  const occasions = composed.occasions.map((occasion) => {
    const edit = edits.occasions?.[occasion.id]
    if (!edit) return occasion
    return {
      ...occasion,
      title: words(edit.title) ?? occasion.title,
      description: words(edit.description) ?? occasion.description
    }
  })

  const renamed = new Map<string, string>()
  for (const { name, renamable } of finalMajorsOf(draft)) {
    const next = words(edits.majors?.[name])
    if (renamable && next !== undefined && !faulted('major', name)) renamed.set(name, majorName(next))
  }
  const majorOf = (major: string): string => renamed.get(major) ?? major

  const recoded = new Map<string, string>()
  const classes: Record<string, ClassEntry> = {}
  for (const [code, entry] of Object.entries(composed.schedules.classes)) {
    const edit = edits.classes?.[code]
    const next = words(edit?.code)
    const kept = next !== undefined && !faulted('code', code) ? next : code
    if (kept !== code) recoded.set(code, kept)
    const changed: ClassEntry = {
      ...entry,
      code: kept,
      name: words(edit?.name) ?? entry.name,
      description: words(edit?.description) ?? entry.description,
      ...(entry.major !== undefined ? { major: majorOf(entry.major) } : {})
    }
    if (isCourse(changed) && edit?.kind) changed.kind = edit.kind
    classes[kept] = changed
  }

  const perChar: Record<string, CharSchedule> = {}
  for (const [charId, schedule] of Object.entries(composed.schedules.perChar)) {
    const edit = finalGirlKindOf(draft, charId) === 'newcomer' ? edits.girls?.[charId] : undefined
    const dorm =
      edit?.dorm !== undefined && schedule.year >= yearFloorOf({ dorm: edit.dorm })
        ? edit.dorm
        : schedule.dorm
    perChar[charId] = {
      ...schedule,
      dorm,
      major: majorOf(schedule.major),
      schedule: Object.fromEntries(
        Object.entries(schedule.schedule).map(([slot, code]) => [slot, recoded.get(code) ?? code])
      )
    }
  }

  const jobs: Record<string, JobAssignment> = { ...composed.jobs }
  const haunts: Record<string, HiddenScheduleAssignment> = { ...composed.haunts }
  const feeds: Record<string, FeedAssignment> = { ...composed.feeds }
  const springBreakPlans: Record<string, string> = { ...composed.springBreakPlans }
  const secrets: Record<string, CharSecret[]> = { ...composed.secrets }
  const pursuits = composed.pursuits ? { ...composed.pursuits } : undefined

  for (const [charId, edit] of Object.entries(edits.girls ?? {})) {
    const kind = finalGirlKindOf(draft, charId)
    if (kind === null) continue
    if (kind === 'newcomer') {
      if (edit.job === null) delete jobs[charId]
      else if (edit.job && !faulted('job', charId) && edit.job.jobId && edit.job.count !== undefined) {
        jobs[charId] = { jobId: edit.job.jobId, count: edit.job.count }
      }
      if (haunts[charId]) haunts[charId] = hauntsOf(haunts[charId], edit, !faulted('activity', charId))
      const handle = words(edit.handle)
      if (feeds[charId] && handle !== undefined && !faulted('handle', charId)) {
        feeds[charId] = { ...feeds[charId], handle: normalizeHandle(handle) }
      }
    }
    if (feeds[charId]) feeds[charId] = postsOf(feeds[charId], edit)
    if (kind !== 'graduate') {
      const plans = words(edit.springBreakPlans)
      if (plans !== undefined && draft.season === 'spring') springBreakPlans[charId] = plans
      if (secrets[charId]) secrets[charId] = secretsOf(secrets[charId], edit)
    }
    if (kind === 'graduate' && pursuits) {
      const pursuit = normalizeActivity(words(edit.pursuit))
      if (pursuit !== '') pursuits[charId] = pursuit
    }
  }

  const semester: StartResult = {
    ...composed,
    schedules: { classes, perChar },
    jobs,
    haunts,
    feeds,
    springBreakPlans,
    occasions,
    secrets,
    ...(pursuits ? { pursuits } : {})
  }
  return { semester, renamed, recoded }
}

/**
 * The composed semester with every change Finalize can keep laid over, through the repairs a
 * reply passes: a new code reseats every timetable, a major renamed reaches every girl taking it
 * and its classes, a girl's choices reach her profile, job and haunts, and her words her feed,
 * plans, secrets and life since. A change that cannot be kept leaves the composed value standing.
 */
export function finalizedOf(draft: ApplicationDraft): StartResult {
  return layOver(draft).semester
}

/** What Finalize has changed of each item, read off the semester it will write. */
export function finalChangesOf(draft: ApplicationDraft): FinalChanges {
  const changes: FinalChanges = {
    occasions: new Set(),
    classes: new Set(),
    majors: new Set(),
    girls: new Set()
  }
  const composed = draft.composed
  if (!composed || !draft.finalEdits) return changes
  const { semester: final, renamed, recoded } = layOver(draft)

  composed.occasions.forEach((occasion, index) => {
    if (!same(occasion, final.occasions[index])) changes.occasions.add(occasion.id)
  })
  for (const [code, entry] of Object.entries(composed.schedules.classes)) {
    const after = final.schedules.classes[recoded.get(code) ?? code]
    const { major: _before, ...own } = entry
    const { major: _after, ...ownAfter } = after ?? entry
    if (!same(own, ownAfter)) changes.classes.add(code)
  }
  for (const [name, next] of renamed) if (next !== name) changes.majors.add(name)
  for (const charId of Object.keys(draft.finalEdits.girls ?? {})) {
    const { schedule: _seats, major: _major, ...before } = composed.schedules.perChar[charId] ?? {}
    const { schedule: _newSeats, major: _newMajor, ...after } = final.schedules.perChar[charId] ?? {}
    const differs =
      !same(before, after) ||
      !same(composed.jobs[charId], final.jobs[charId]) ||
      !same(composed.haunts[charId], final.haunts[charId]) ||
      !same(composed.feeds[charId], final.feeds[charId]) ||
      !same(composed.springBreakPlans[charId], final.springBreakPlans[charId]) ||
      !same(composed.secrets[charId], final.secrets[charId]) ||
      !same(composed.pursuits?.[charId], final.pursuits?.[charId])
    if (differs) changes.girls.add(charId)
  }
  return changes
}
