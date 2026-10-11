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

/** What a game played alone comes to, as the scene's narration says it. */
export function soloSummary(right: number): string {
  const calls = `${right} of ${CALLS_EACH} calls right`
  if (right === CALLS_EACH) return `You deal yourself a game of High-Low and get all ${calls}. A perfect run.`
  if (right === 0) return `You deal yourself a game of High-Low and get ${calls}. The deck had it in for you.`
  return `You deal yourself a game of High-Low and get ${calls}.`
}
