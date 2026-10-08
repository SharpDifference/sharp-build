/**
 * Who texts the reader as a slot opens, as odds and draws: an invitation's chance by disposition
 * and the slot's modulation of it, a reach-out's chance and what it is about, the waits an
 * unanswered text serves, and the weighted draw that turns a slate of chances into names. Pure
 * and randomised; the caller reads the store.
 */

import { globalSlotOf } from '@shared/jobs'
import type { Disposition } from '@shared/relationship'
import type { ChatMessage, Conversation, TimeSlot } from '@shared/types'
import { MIDTERM_WEEK, FINALS_WEEK } from '../prompts/occasions'
import { weekendSaturdayOf } from '../prompts/gameDate'
import { REACH_OUT_TOPICS, type ReachOutTopic } from '../prompts/slotIntroPrompt'

/** Her base odds of asking him out in one slot, by what she is to him. */
const ASK_CHANCE = {
  lover: 0.4,
  devoted: 0.3,
  trusted: 0.25,
  friendly: 0.16,
  neutral: 0.04,
  lonelyNeutral: 0.1
} as const

/** What the slot itself does to those odds: free hours invite, exam weeks do not. */
const SLOT_CHANCE = { weekend: 1.5, weekdayDay: 0.8, examWeek: 0.5 } as const

/** However many win their roll, only this many are asked in one slot. */
const MAX_ASKERS = 2

/** Slots of quiet the whole roster keeps after any one invitation lands. */
export const ASK_QUIET_SLOTS = 2

/** Slots she waits before asking again when the last invitation was answered. */
const ASK_COOLDOWN_SLOTS = 3

/** The first wait an unanswered invitation buys, doubling with each one after it. */
const DECLINE_COOLDOWN_BASE = 4

/** The longest that doubling reaches — two weeks of slots. */
const DECLINE_COOLDOWN_CAP = 28

/** Her odds of reaching out just to talk in one slot, by what she is to him; nobody less reaches out. */
const REACH_OUT_CHANCE = {
  lover: 0.3,
  devoted: 0.22,
  trusted: 0.15,
  friendly: 0.08
} as const

/** However many win their roll, only this many reach out in one slot. */
const MAX_REACH_OUTS = 1

/** Slots of quiet the whole roster keeps after any one reach-out lands. */
export const REACH_OUT_QUIET_SLOTS = 1

/** Slots her thread has to have been quiet before she reaches out, with nothing of hers unanswered. */
const REACH_OUT_GAP_SLOTS = 3

/** The first wait a reach-out he never answered buys, doubling with each one after it. */
const UNANSWERED_REACH_OUT_BASE = 6

/** The longest that doubling reaches — two weeks of slots. */
const UNANSWERED_REACH_OUT_CAP = 28

/** What {@link askChanceOf} weighs: where she stands with him, and whether she has anyone else. */
export interface AskChanceInput {
  isLover: boolean
  disposition: Disposition
  /** Nobody on the roster is her friend, so the reader is who she has. */
  lonely: boolean
}

/** Her odds of asking him out this slot: her band's, times what the slot is worth. */
export function askChanceOf(input: AskChanceInput, slotMultiplier: number): number {
  const base = input.isLover
    ? ASK_CHANCE.lover
    : input.disposition === 'devoted'
      ? ASK_CHANCE.devoted
      : input.disposition === 'trusted'
        ? ASK_CHANCE.trusted
        : input.disposition === 'friendly'
          ? ASK_CHANCE.friendly
          : input.disposition === 'neutral'
            ? input.lonely
              ? ASK_CHANCE.lonelyNeutral
              : ASK_CHANCE.neutral
            : 0
  return base * slotMultiplier
}

/** What one slot is worth to an invitation: the weekend, the working day and the exam weeks. */
export function slotAskMultiplier(date: number, time: TimeSlot): number {
  let multiplier = 1
  if (weekendSaturdayOf(date) !== null) multiplier *= SLOT_CHANCE.weekend
  else if (time === 0) multiplier *= SLOT_CHANCE.weekdayDay
  const inExamWeek =
    (date >= MIDTERM_WEEK.startDate && date <= MIDTERM_WEEK.endDate) ||
    (date >= FINALS_WEEK.startDate && date <= FINALS_WEEK.endDate)
  if (inExamWeek) multiplier *= SLOT_CHANCE.examWeek
  return multiplier
}

/** The slot of her newest text that `marked` picks out, or null when there is none. */
function lastMarkedSlotOf(
  conversation: Conversation | undefined,
  marked: (message: ChatMessage) => boolean
): number | null {
  const messages = conversation?.messages ?? []
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.sender === 'contact' && marked(message)) {
      return globalSlotOf(message.date, message.time)
    }
  }
  return null
}

/** The slot her latest invitation was sent in, or null when she has never sent one. */
export function lastInviteSlotOf(conversation: Conversation | undefined): number | null {
  return lastMarkedSlotOf(conversation, (message) => message.invite === true)
}

/** The slot her latest reach-out was sent in, or null when she has never reached out. */
export function lastReachOutSlotOf(conversation: Conversation | undefined): number | null {
  return lastMarkedSlotOf(conversation, (message) => message.reachOut === true)
}

/** The slot of the newest text either of them sent, or null for a thread of system lines alone. */
export function lastTextSlotOf(conversation: Conversation | undefined): number | null {
  const messages = conversation?.messages ?? []
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.sender !== 'system') return globalSlotOf(message.date, message.time)
  }
  return null
}

/** Her odds of reaching out this slot: her band's, the lover band ahead of any tier. */
export function reachOutChanceOf(isLover: boolean, disposition: Disposition): number {
  if (isLover) return REACH_OUT_CHANCE.lover
  return disposition === 'devoted'
    ? REACH_OUT_CHANCE.devoted
    : disposition === 'trusted'
      ? REACH_OUT_CHANCE.trusted
      : disposition === 'friendly'
        ? REACH_OUT_CHANCE.friendly
        : 0
}

/**
 * How long her thread has to have been quiet before she reaches out, doubling for every
 * reach-out of hers he has left unanswered.
 */
export function reachOutGapSlots(unanswered: number): number {
  if (unanswered <= 0) return REACH_OUT_GAP_SLOTS
  return Math.min(UNANSWERED_REACH_OUT_CAP, UNANSWERED_REACH_OUT_BASE * 2 ** (unanswered - 1))
}

/** What she reaches out about, drawn evenly. */
export function rollReachOutTopic(rand: () => number = Math.random): ReachOutTopic {
  const index = Math.min(REACH_OUT_TOPICS.length - 1, Math.floor(rand() * REACH_OUT_TOPICS.length))
  return REACH_OUT_TOPICS[index]
}

/** How long she waits before asking again, doubling for every invitation he let stand. */
export function declineCooldownSlots(declined: number): number {
  if (declined <= 0) return ASK_COOLDOWN_SLOTS
  return Math.min(DECLINE_COOLDOWN_CAP, DECLINE_COOLDOWN_BASE * 2 ** (declined - 1))
}

/** Whether `gap` slots have passed since `last`; a slot nobody has asked in is always over. */
export function askCooldownOver(last: number | null, slot: number, gap: number): boolean {
  if (last === null) return true
  return slot - last > gap
}

/** One roster member's odds this slot, as {@link rollSlotAskers} draws against them. */
export interface SlotAskCandidate {
  charId: string
  chance: number
}

/**
 * Rolls every candidate, then draws at most `max` of the winners without replacement, each
 * winner weighted by her own chance. Returns the charIds in draw order.
 */
export function rollSlotAskers(
  candidates: readonly SlotAskCandidate[],
  rand: () => number = Math.random,
  max: number = MAX_ASKERS
): string[] {
  const winners: SlotAskCandidate[] = []
  for (const candidate of candidates) {
    if (candidate.chance > 0 && rand() < candidate.chance) winners.push(candidate)
  }

  const picked: string[] = []
  const pool = [...winners]
  while (picked.length < max && pool.length > 0) {
    const total = pool.reduce((sum, candidate) => sum + candidate.chance, 0)
    let ticket = rand() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      ticket -= pool[i].chance
      if (ticket < 0) {
        index = i
        break
      }
    }
    picked.push(pool[index].charId)
    pool.splice(index, 1)
  }
  return picked
}

/** The one girl who reaches out this slot, drawn as {@link rollSlotAskers} draws, or null. */
export function rollSlotReachOut(
  candidates: readonly SlotAskCandidate[],
  rand: () => number = Math.random
): string | null {
  return rollSlotAskers(candidates, rand, MAX_REACH_OUTS)[0] ?? null
}

/** One contact who could ask him to the slot's occasion, and whether the slot places her anywhere. */
export interface OccasionAskCandidate {
  charId: string
  /** Nothing has her anywhere this slot, so she is the first anybody is drawn from. */
  loose: boolean
}

/**
 * Draws the one girl who asks him to this slot's occasion: evenly among those the slot places
 * nowhere, and only failing those among the rest. Null when nobody is left to ask.
 */
export function drawOccasionAsker(
  candidates: readonly OccasionAskCandidate[],
  rand: () => number = Math.random
): string | null {
  const loose = candidates.filter((candidate) => candidate.loose)
  const pool = loose.length > 0 ? loose : candidates
  if (pool.length === 0) return null
  const index = Math.min(pool.length - 1, Math.floor(rand() * pool.length))
  return pool[index].charId
}
