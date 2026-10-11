import { shuffle } from './shuffle'

/** High-Low's rules: the deck, a call, and whether the next card made it good. */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export interface Card {
  /** 2 to 14: the jack, queen, king and ace are 11 to 14. */
  rank: number
  suit: Suit
}

export type Call = 'higher' | 'lower'

/** How many calls one player makes in a game. */
export const CALLS_EACH = 5

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

/** A full deck, shuffled. */
export function freshDeck(rand: () => number = Math.random): Card[] {
  const deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i): Card => ({ rank: i + 2, suit }))
  )
  return shuffle(deck, rand)
}

/** Whether a call came good. A card of the same rank is a miss either way. */
export function callWins(shown: Card, next: Card, call: Call): boolean {
  return call === 'higher' ? next.rank > shown.rank : next.rank < shown.rank
}

const FACES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

/** A rank as a card prints it. */
export function rankMark(rank: number): string {
  return FACES[rank] ?? String(rank)
}

/** How a girl plays, from 1 (on hunches) to 5 (counts every card). */
export type Skill = 1 | 2 | 3 | 4 | 5

/**
 * The call the cards favour on `shown`, given every card turned so far (`shown` among them), and
 * by how much: the share of the cards still in the deck that separates the two calls.
 */
export function oddsCall(shown: Card, seen: readonly Card[]): { call: Call; edge: number } {
  let higher = 0
  let lower = 0
  for (let rank = 2; rank <= 14; rank++) {
    const left = 4 - seen.filter((card) => card.rank === rank).length
    if (rank > shown.rank) higher += left
    else if (rank < shown.rank) lower += left
  }
  const left = 52 - seen.length
  return {
    call: higher >= lower ? 'higher' : 'lower',
    edge: left > 0 ? Math.abs(higher - lower) / left : 0
  }
}

/** The edge under which she stops reading the cards and goes on a hunch, by skill. */
const HUNCH_UNDER: Record<Skill, number> = { 1: 0.5, 2: 0.35, 3: 0.2, 4: 0.1, 5: 0 }

/**
 * Her call. Everyone calls lower on a king; what skill buys is the close ones: the better she
 * is, the finer an edge she still reads, and under that she is guessing.
 */
export function herCall(
  shown: Card,
  seen: readonly Card[],
  skill: Skill,
  rand: () => number = Math.random
): Call {
  const { call, edge } = oddsCall(shown, seen)
  if (edge > HUNCH_UNDER[skill]) return call
  return rand() < 0.5 ? 'higher' : 'lower'
}

/** What a game played alone comes to, as the scene's narration says it. */
export function soloSummary(right: number): string {
  const calls = `${right} of ${CALLS_EACH} calls right`
  if (right === CALLS_EACH) return `You deal yourself a game of High-Low and get all ${calls}. A perfect run.`
  if (right === 0) return `You deal yourself a game of High-Low and get ${calls}. The deck had it in for you.`
  return `You deal yourself a game of High-Low and get ${calls}.`
}

/** What a game against her comes to, as the scene's narration says it. */
export function versusSummary(name: string, mine: number, hers: number): string {
  if (mine > hers) return `You play High-Low with ${name} and win, ${mine} calls to ${hers}.`
  if (mine < hers) return `You play High-Low with ${name} and lose, ${mine} calls to ${hers}.`
  return `You play High-Low with ${name} and it ends level, ${mine} calls each.`
}

/** One call of a finished game, as the account tells it. */
export interface CallMade {
  hers: boolean
  call: Call
  right: boolean
}

/**
 * How a game against her went, call by call, for the scene's writer: who called what on which
 * card and what came, with the calls worth a remark marked: a long shot that landed, a safe one
 * that failed, the same card turning up twice. `deck` is the deck as it was dealt.
 */
export function versusAccount(
  name: string,
  deck: readonly Card[],
  calls: readonly CallMade[]
): string[] {
  const lines = calls.map((made, i) => {
    const shown = deck[i]
    const next = deck[i + 1]
    const { call: favoured, edge } = oddsCall(shown, deck.slice(0, i + 1))
    const note =
      next.rank === shown.rank
        ? ', the same card again'
        : made.right && made.call !== favoured && edge >= 0.3
          ? ', a long shot that came in'
          : !made.right && made.call === favoured && edge >= 0.5
            ? ', a safe call that failed'
            : ''
    const who = made.hers ? name : 'The reader'
    return `${who} called ${made.call} on a ${rankMark(shown.rank)} and a ${rankMark(next.rank)} came: ${made.right ? 'right' : 'a miss'}${note}.`
  })
  const count = (side: boolean): number =>
    calls.filter((made) => made.hers === side && made.right).length
  return [
    `Each called ${CALLS_EACH} times, in turn, on whether the next card would be higher or lower.`,
    ...lines,
    `Final count: the reader ${count(false)}, ${name} ${count(true)}.`
  ]
}
