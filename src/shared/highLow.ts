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

const WORDS: Record<number, string> = {
  2: 'a two',
  3: 'a three',
  4: 'a four',
  5: 'a five',
  6: 'a six',
  7: 'a seven',
  8: 'an eight',
  9: 'a nine',
  10: 'a ten',
  11: 'a jack',
  12: 'a queen',
  13: 'a king',
  14: 'an ace'
}

/** A rank as it is said aloud, with its article. */
export function rankWord(rank: number): string {
  return WORDS[rank] ?? String(rank)
}

/** A call and what it turned, as the scene's narration says it. `who` is "You" or her name. */
export function callLine(who: string, call: Call, shown: Card, next: Card): string {
  const verb = who === 'You' ? 'call' : 'calls'
  const came =
    next.rank === shown.rank
      ? `${rankWord(next.rank)} again: a miss`
      : `${rankWord(next.rank)}: ${callWins(shown, next, call) ? 'right' : 'a miss'}`
  return `${who} ${verb} ${call}. ${came.charAt(0).toUpperCase()}${came.slice(1)}.`
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
 * card and what came, with the calls worth a remark marked and bad play told apart from bad
 * luck: a long shot that landed, a safe call that failed, a call against the cards, one that
 * could not win. `deck` is the deck as it was dealt.
 */
export function versusAccount(
  name: string,
  deck: readonly Card[],
  calls: readonly CallMade[]
): string[] {
  /** How many times each side called against cards that clearly favoured the other call. */
  const against = { reader: 0, her: 0 }
  const lines = calls.map((made, i) => {
    const shown = deck[i]
    const next = deck[i + 1]
    const { call: favoured, edge } = oddsCall(shown, deck.slice(0, i + 1))
    const hopeless =
      (made.call === 'lower' && shown.rank === 2) || (made.call === 'higher' && shown.rank === 14)
    const poor = made.call !== favoured && edge >= 0.3
    if (poor) against[made.hers ? 'her' : 'reader']++
    const note = hopeless
      ? `, a call that could not win: nothing is ${made.call} than ${rankWord(shown.rank)}`
      : next.rank === shown.rank
        ? ', the same card again'
        : poor && made.right
          ? ', a long shot that came in'
          : poor
            ? `, a bad call: the cards clearly favoured ${favoured}`
            : !made.right && edge >= 0.5
              ? ', a safe call that failed: plain bad luck'
              : ''
    const who = made.hers ? name : 'The reader'
    return `${who} called ${made.call} on ${rankWord(shown.rank)} and ${rankWord(next.rank)} came: ${made.right ? 'right' : 'a miss'}${note}.`
  })
  const played = (who: string, times: number): string =>
    times === 0
      ? `${who} played the odds every time.`
      : `${who} called against the odds ${times} time${times === 1 ? '' : 's'}: poor play, not bad luck.`
  const count = (side: boolean): number =>
    calls.filter((made) => made.hers === side && made.right).length
  return [
    `Each called ${CALLS_EACH} times, in turn, on whether the next card would be higher or lower. Twos are low and aces high; the same rank again is a miss.`,
    ...lines,
    played('The reader', against.reader),
    played(name, against.her),
    `Final count: the reader ${count(false)}, ${name} ${count(true)}.`
  ]
}
