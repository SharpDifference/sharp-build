import { globalSlotOf } from '@shared/jobs'
import { optionOn } from '@shared/mods'
import { STAT_ATTRACTIONS } from '@shared/playerStats'
import {
  affectionFor,
  contactRevealsOf,
  dedupedMemoriesFor,
  emptyFlags,
  loveLifeBlurb,
  relationshipTagOf
} from '@shared/relationship'
import { memoryBudgetFor } from '@shared/settingsRules'
import {
  ASSISTANT_CHOICES,
  cleanAssistantConfig,
  STORY_ASSISTANT,
  storyAssistantReplyOf,
  type StoryAssistantConfig,
  type StoryAssistantReply
} from '@shared/storyAssistant'
import type { Character, SceneLine, SceneSummaryMark, TimeSlot } from '@shared/types'
import { create } from 'zustand'
import { formatChatDivider, formatDateBanner } from '../prompts/gameDate'
import { isGraduationSlot } from '../prompts/graduation'
import { isOrientationSlot } from '../prompts/introScript'
import { memoryLines, notesLines, secretLines } from '../prompts/scenePrompt'
import { transcriptStubs } from '../prompts/schedulePrompt'
import {
  buildStoryAssistantPrompt,
  DEFAULT_ASSISTANT_PROMPT,
  wholeWord,
  type AssistantContext,
  type AssistantGirl
} from '../prompts/storyAssistantPrompt'
import { upcomingPlanLines } from '../prompts/upcomingPlans'
import { useGameStore } from './gameStore'
import { settingNow } from './lorebookStore'
import { useModsStore } from './modsStore'
import { replyRowOfferOf } from './loop/playback'
import {
  lessNsfwTextNow,
  memoryBudgetsNow,
  reader,
  sceneSoFar,
  secretBudgetNow
} from './loop/promptState'

type GameState = ReturnType<typeof useGameStore.getState>

/** How the assistant's seat stands on the rail. */
export type AssistantSeat = 'shown' | 'dim' | 'gone'

/**
 * Where the seat stands: gone wherever there is no cast scene to talk about — a replay, a created
 * scene, an exam, a solo scene, the orientation and the graduation epilogue, a scene into its
 * ending — and shown only where every line delivered has been read and a turn could go out.
 */
export function assistantSeatOf(s: GameState): AssistantSeat {
  if (s.replaying || s.createdScene || s.activeGameOver || s.sceneQuiz) return 'gone'
  if (s.sceneEnding || s.statusShown || s.statusModal !== null) return 'gone'
  if (s.cast.length === 0) return 'gone'
  if (isOrientationSlot(s.date, s.time, s.semesterIndex) || isGraduationSlot(s.date, s.time)) return 'gone'
  if (s.busy || s.streaming || s.pendingLines.length > 0 || s.turnError) return 'dim'
  return s.awaitingInput || replyRowOfferOf(s) === 'open' ? 'shown' : 'dim'
}

/** The point in the scene a read is taken at; any change to the scene since makes it stale. */
interface ScenePoint {
  playthroughId: string | null
  loads: number
  transcript: readonly SceneLine[]
  marks: readonly SceneSummaryMark[]
}

/** The point a game stands at. */
function pointOf(game: Pick<GameState, 'playthroughId' | 'loads' | 'currentSceneTranscript' | 'sceneSummaries'>): ScenePoint {
  return {
    playthroughId: game.playthroughId,
    loads: game.loads,
    transcript: game.currentSceneTranscript,
    marks: game.sceneSummaries
  }
}

/** Whether two points are one: the same game and the very same scene, line for line. */
function samePoint(a: ScenePoint, b: ScenePoint): boolean {
  return (
    a.playthroughId === b.playthroughId &&
    a.loads === b.loads &&
    a.transcript === b.transcript &&
    a.marks === b.marks
  )
}

/** A read that came back: where it was taken, what was asked, and what the assistant said. */
export interface AssistantRead {
  point: ScenePoint
  question: string
  reply: StoryAssistantReply
}

/** Story Assistant's state: its config, and the newest read, read under way or failure. */
interface AssistantState {
  config: StoryAssistantConfig
  read: AssistantRead | null
  /** A read under way, by the cancel group it went out under. */
  asking: { point: ScenePoint; question: string; group: string } | null
  failed: { point: ScenePoint; question: string; message: string } | null
}

export const useAssistantStore = create<AssistantState>(() => ({
  config: {},
  read: null,
  asking: null,
  failed: null
}))

/** The config's one read, once something that needs it is on screen. */
let configRead: Promise<void> | null = null

/** Reads the player's prompt off the bridge, once; a config that cannot be read leaves the shipped one. */
export function loadAssistantConfig(): Promise<void> {
  configRead ??= window.api.storyAssistant.get().then((result) => {
    if (result.ok) useAssistantStore.setState({ config: result.data })
    else console.warn('[story-assistant] could not read the config:', result.error.message)
  })
  return configRead
}

/**
 * Keeps `text` as the player's prompt, or goes back to the shipped one where it is blank or the
 * shipped text itself; null once written, or the sentence saying why it was not.
 */
export async function saveAssistantPrompt(text: string): Promise<string | null> {
  const trimmed = text.trim()
  const config: StoryAssistantConfig =
    trimmed && trimmed !== DEFAULT_ASSISTANT_PROMPT ? { prompt: trimmed } : {}
  const result = await window.api.storyAssistant.set(config)
  if (!result.ok) return result.error.message
  useAssistantStore.setState({ config: cleanAssistantConfig(config) })
  return null
}

/** What the assistant has where the scene stands now: a read, one under way, or a failure. */
export interface AssistantNow {
  read: AssistantRead | null
  asking: AssistantState['asking']
  failed: AssistantState['failed']
}

/** {@link AssistantNow} off the two stores; anything taken at another point is none. */
export function assistantNowOf(state: AssistantState, game: GameState): AssistantNow {
  const now = pointOf(game)
  const at = <T extends { point: ScenePoint }>(entry: T | null): T | null =>
    entry && samePoint(entry.point, now) ? entry : null
  return { read: at(state.read), asking: at(state.asking), failed: at(state.failed) }
}

/** {@link AssistantNow} for a component, kept current as either store moves. */
export function useAssistantNow(): AssistantNow {
  const state = useAssistantStore()
  // Each a field of its own, so the hook answers to the scene moving and nothing else.
  useGameStore((s) => s.currentSceneTranscript)
  useGameStore((s) => s.sceneSummaries)
  useGameStore((s) => s.loads)
  useGameStore((s) => s.playthroughId)
  return assistantNowOf(state, useGameStore.getState())
}

/** Cancels the read under way, if any; its answer is then dropped unseen. */
export function cancelAssistant(): void {
  const { asking } = useAssistantStore.getState()
  if (!asking) return
  void window.api.jobs.cancelGroup(asking.group)
  useAssistantStore.setState({ asking: null })
}

/** Cancels a read under way that the scene has since moved past. */
export function cancelStaleAssistant(): void {
  const { asking } = useAssistantStore.getState()
  if (asking && !samePoint(asking.point, pointOf(useGameStore.getState()))) cancelAssistant()
}

/** How many earlier slots are carried whatever they were about. */
const EARLIER_NEWEST = 4
/** How many more, further back, are carried for naming a girl in the scene. */
const EARLIER_NAMING = 4

/**
 * The finished slots before this one worth the assistant knowing, dated and oldest first: the
 * newest few, and a few further back that name a girl in the scene by the name he knows her by.
 */
function earlierSlots(game: GameState, names: readonly string[]): string[] {
  const now = globalSlotOf(game.date, game.time)
  const slots = Object.entries(game.history)
    .flatMap(([day, halves]) =>
      ([0, 1] as TimeSlot[]).flatMap((time) => {
        const summary = halves?.[time]?.trim()
        const date = Number(day)
        return summary && globalSlotOf(date, time) < now ? [{ date, time, summary }] : []
      })
    )
    .sort((a, b) => globalSlotOf(b.date, b.time) - globalSlotOf(a.date, a.time))
  const naming = (summary: string): boolean => names.some((name) => wholeWord(name).test(summary))
  const picked = [
    ...slots.slice(0, EARLIER_NEWEST),
    ...slots.slice(EARLIER_NEWEST).filter((slot) => naming(slot.summary)).slice(0, EARLIER_NAMING)
  ]
  return picked
    .reverse()
    .map((slot) => `${formatChatDivider(slot.date, slot.time, game.calendar.season)}: ${slot.summary}`)
}

/** One girl in the scene as the player has been shown her, off her contact page's own rule. */
function girlOf(game: GameState, character: Character, castSize: number, plans: string[]): AssistantGirl {
  const info = game.charInfo[character.charId]
  const flags = info?.flags ?? emptyFlags()
  const affection = affectionFor(info, game.date, character)
  const reveals = contactRevealsOf(flags, affection)
  const name = info?.nameKnown ? character.firstName : null
  const profile: string[] = []
  const record: string[] = []
  if (name !== null && reveals.profile) {
    if (character.likes?.length) profile.push(`${name} likes: ${character.likes.join(', ')}.`)
    if (character.dislikes?.length) profile.push(`${name} dislikes: ${character.dislikes.join(', ')}.`)
    if (reveals.traits) profile.push(`${name} likes guys with ${STAT_ATTRACTIONS[character.preferredStat]}.`)
    if (reveals.backstory && character.backstory?.trim()) profile.push(`Backstory: ${character.backstory.trim()}`)
    const loveLife = loveLifeBlurb(character, flags)
    if (reveals.loveLife && loveLife) profile.push(`Love life: ${loveLife}`)
    const budget = memoryBudgetFor(memoryBudgetsNow(), castSize)
    record.push(
      ...memoryLines(character, dedupedMemoriesFor(info).slice(-budget), info?.textMemory, game.calendar.season)
    )
  }
  if (name !== null) {
    record.push(...secretLines(info?.toldSecrets, secretBudgetNow()))
    record.push(...notesLines(name, info?.notes))
    record.push(...plans)
  }
  return {
    name,
    names: [character.firstName, character.lastName],
    tag: relationshipTagOf(flags, affection),
    flags,
    profile,
    record
  }
}

/** What one read of the scene is built from, off the store as it stands. */
function contextNow(question: string): AssistantContext {
  const game = useGameStore.getState()
  const season = game.calendar.season
  const cast = game.cast.flatMap((charId) => game.characters[charId] ?? [])
  const present = cast.filter((character) => !game.departed.includes(character.charId))
  // From the next slot on: a plan for this one is the scene being played.
  const plans = upcomingPlanLines(game.events, game.characters, globalSlotOf(game.date, game.time) + 1, season)
  const girls = present.map((character) =>
    girlOf(game, character, present.length, plans[character.charId] ?? [])
  )
  const known = girls.flatMap((girl) => (girl.name ? [girl.name] : []))
  return {
    setting: settingNow(),
    reader: reader(),
    when: formatDateBanner(game.date, game.time, season),
    earlier: earlierSlots(game, known),
    girls,
    summary: game.sceneSummary,
    lines: transcriptStubs(sceneSoFar(), cast, true),
    question,
    prompt: useAssistantStore.getState().config.prompt ?? '',
    choices: optionOn(useModsStore.getState().switches, STORY_ASSISTANT, ASSISTANT_CHOICES.fit)
      ? 'fit'
      : 'four',
    lessNsfwText: lessNsfwTextNow()
  }
}

/** Tells the asks apart, so only the newest one's answer lands. */
let asks = 0

/**
 * Asks for a read of the scene where it stands, `question` answered where one is given, in place
 * of any read still under way. What comes back is kept on the store; an answer that lands after
 * the scene has moved, or after a later ask, is dropped unseen.
 */
export async function askAssistant(question: string): Promise<void> {
  cancelAssistant()
  const point = pointOf(useGameStore.getState())
  const asked = question.trim()
  const group = `story-assistant:${++asks}`
  useAssistantStore.setState({ asking: { point, question: asked, group }, failed: null })
  await loadAssistantConfig()
  if (useAssistantStore.getState().asking?.group !== group) return
  const result = await window.api.llm.completeStoryAssistant(
    buildStoryAssistantPrompt(contextNow(asked)),
    group
  )
  if (useAssistantStore.getState().asking?.group !== group) return
  if (!samePoint(point, pointOf(useGameStore.getState()))) {
    useAssistantStore.setState({ asking: null })
    return
  }
  const reply = result.ok ? storyAssistantReplyOf(result.data) : null
  if (reply) {
    useAssistantStore.setState({ asking: null, read: { point, question: asked, reply } })
    return
  }
  const message = result.ok
    ? 'The assistant came back with nothing to say.'
    : result.error.message
  useAssistantStore.setState({ asking: null, failed: { point, question: asked, message } })
}
