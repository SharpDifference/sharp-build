import { globalSlotOf } from '@shared/jobs'
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
import { storyAssistantReplyOf, type StoryAssistantReply } from '@shared/storyAssistant'
import type { Character, SceneLine, SceneSummaryMark, TimeSlot } from '@shared/types'
import { formatChatDivider, formatDateBanner } from '../prompts/gameDate'
import { isGraduationSlot } from '../prompts/graduation'
import { isOrientationSlot } from '../prompts/introScript'
import { memoryLines, notesLines, secretLines } from '../prompts/scenePrompt'
import { transcriptStubs } from '../prompts/schedulePrompt'
import {
  buildStoryAssistantPrompt,
  wholeWord,
  type AssistantContext,
  type AssistantGirl
} from '../prompts/storyAssistantPrompt'
import { upcomingPlanLines } from '../prompts/upcomingPlans'
import { useGameStore } from './gameStore'
import { settingNow } from './lorebookStore'
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

/** The point in the scene one read was taken at; any change to the scene since makes it stale. */
interface ReadPoint {
  playthroughId: string | null
  loads: number
  transcript: readonly SceneLine[]
  marks: readonly SceneSummaryMark[]
  question: string
}

/** The point the scene stands at now, for a read asked with `question`. */
function pointNow(question: string): ReadPoint {
  const game = useGameStore.getState()
  return {
    playthroughId: game.playthroughId,
    loads: game.loads,
    transcript: game.currentSceneTranscript,
    marks: game.sceneSummaries,
    question: question.trim()
  }
}

/** Whether two points are one: the same game and the very same scene, line for line. */
function samePoint(a: ReadPoint, b: ReadPoint): boolean {
  return (
    a.playthroughId === b.playthroughId &&
    a.loads === b.loads &&
    a.transcript === b.transcript &&
    a.marks === b.marks &&
    a.question === b.question
  )
}

/** The last read that came back, and the point it was taken at. */
let kept: { point: ReadPoint; reply: StoryAssistantReply } | null = null

/** The last read, while the scene still stands where it was taken; null once it has moved. */
export function keptRead(): { question: string; reply: StoryAssistantReply } | null {
  if (!kept) return null
  const now = pointNow(kept.point.question)
  return samePoint(kept.point, now) ? { question: kept.point.question, reply: kept.reply } : null
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
    lessNsfwText: lessNsfwTextNow()
  }
}

/**
 * Asks for a read of the scene where it stands, `question` answered where one is given. The reply
 * is kept for the panel to reopen on; one that lands after the scene has moved is refused.
 */
export async function askAssistant(question: string, group: string): Promise<StoryAssistantReply> {
  const point = pointNow(question)
  const result = await window.api.llm.completeStoryAssistant(
    buildStoryAssistantPrompt(contextNow(point.question)),
    group
  )
  if (!samePoint(point, pointNow(question))) throw new Error('The scene moved on. Ask again.')
  if (!result.ok) throw new Error(result.error.message)
  const reply = storyAssistantReplyOf(result.data)
  if (!reply) throw new Error('The assistant came back with nothing to say. Ask again.')
  kept = { point, reply }
  return reply
}
