import { freshDeck, rankWord, type Card, type Skill } from './highLow'

/** Blackjack's rules, heads-up: what a hand is worth, which hand wins, and how she plays hers. */

export type Move = 'hit' | 'stand'

/** How many hands a match is where nothing was settled. */
export const HANDS = 3

/** The deck is shuffled afresh before a hand that would start with fewer cards than this. */
export const RESHUFFLE_UNDER = 16

/** What a hand comes to: aces are 11 while that keeps it at 21 or under. `soft` is one that is. */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (card.rank === 14) aces++
    total += card.rank === 14 ? 11 : Math.min(card.rank, 10)
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

/** A 21 in two cards. */
export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21
}

/**
 * Where a hand stands against another: its total, with a bust below everything and a two-card
 * 21 above a 21 made with more.
 */
export function standing(cards: readonly Card[]): number {
  const { total } = handTotal(cards)
  return total > 21 ? -1 : isNatural(cards) ? 22 : total
}

export type HandWinner = 'reader' | 'her' | 'push'

/** Who takes a finished hand. The reader plays first, so his bust loses it whatever she holds. */
export function handWinner(mine: readonly Card[], hers: readonly Card[]): HandWinner {
  const [a, b] = [standing(mine), standing(hers)]
  if (a < 0) return 'her'
  return a > b ? 'reader' : a < b ? 'her' : 'push'
}

/** The top card and the deck without it; a fresh deck is cut where the old one has run out. */
export function drawCard(deck: readonly Card[], rand: () => number = Math.random): [Card, Card[]] {
  const from = deck.length > 0 ? deck : freshDeck(rand)
  return [from[0], from.slice(1)]
}

/**
 * The right move for her, who plays last and sees what she has to beat: nothing once he has
 * bust or she is ahead, a card for as long as she is behind, and on level totals a card only
 * while it is likelier to help than to break her. A two-card 21 of his cannot be caught, so she
 * leaves a beaten hand alone.
 */
export function soundMove(hers: readonly Card[], mine: readonly Card[]): Move {
  const [a, b] = [standing(hers), standing(mine)]
  if (b < 0 || a > b || b === 22) return 'stand'
  if (a < b) return 'hit'
  const { total, soft } = handTotal(hers)
  return total <= (soft ? 17 : 14) ? 'hit' : 'stand'
}

/** How often she gets a decision wrong where there is one to get wrong, by skill. */
const SLIP: Record<Skill, number> = { 1: 0.42, 2: 0.3, 3: 0.18, 4: 0.08, 5: 0 }

/**
 * Her move. The best player always makes the sound one. The rest make a person's mistakes, the
 * more often the weaker they are: losing their nerve and standing on a total that is still
 * beaten or only level, where a card could break them, and reaching for one more card on a
 * middling hand that was already ahead.
 */
export function herMove(
  hers: readonly Card[],
  mine: readonly Card[],
  skill: Skill,
  rand: () => number = Math.random
): Move {
  const sound = soundMove(hers, mine)
  const slip = SLIP[skill]
  if (slip === 0) return sound
  const { total, soft } = handTotal(hers)
  if (sound === 'hit') {
    if (soft || total < 12) return 'hit'
    return rand() < slip ? 'stand' : 'hit'
  }
  const [a, b] = [standing(hers), standing(mine)]
  if (b < 0 || b === 22 || a <= b || total > 17) return 'stand'
  return rand() < slip / 2 ? 'hit' : 'stand'
}

/** Whether the match is over: every hand played, or one of them too far ahead to be caught. */
export function matchOver(mine: number, hers: number, played: number, hands: number): boolean {
  return played >= hands || Math.abs(mine - hers) > hands - played
}

/** A card the reader asked for, and what he held when he asked. */
export interface HitMade {
  total: number
  soft: boolean
}

/** A move of hers, what she held when she made it, and what the sound move was. */
export interface HerMoveMade {
  move: Move
  total: number
  sound: Move
}

/** One finished hand: the cards each ended with, and how each got there. */
export interface HandPlayed {
  mine: readonly Card[]
  hers: readonly Card[]
  hits: readonly HitMade[]
  herMoves: readonly HerMoveMade[]
}

/** Hands won by each over the hands played so far. */
export function handsWon(hands: readonly HandPlayed[]): { mine: number; hers: number } {
  const won = (who: HandWinner): number =>
    hands.filter((hand) => handWinner(hand.mine, hand.hers) === who).length
  return { mine: won('reader'), hers: won('her') }
}

/** Two or more cards said aloud: "a king and a six". */
export function cardsWord(cards: readonly Card[]): string {
  const words = cards.map((card) => rankWord(card.rank))
  return words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** A hand's total as the narration says it. */
export function totalWord(cards: readonly Card[]): string {
  return isNatural(cards) ? '21 in two cards' : String(handTotal(cards).total)
}

/** The deal of a hand, as the scene's narration says it. `up` is her card that shows. */
export function dealLine(name: string, no: number, mine: readonly Card[], up: Card): string {
  return `Hand ${no}. You are dealt ${cardsWord(mine)}: ${totalWord(mine)}. ${name} shows ${rankWord(up.rank)}, her other card face down.`
}

/** How a finished hand came out, as the scene's narration says it. */
export function resultLine(name: string, mine: readonly Card[], hers: readonly Card[]): string {
  const winner = handWinner(mine, hers)
  if (standing(mine) < 0) return `The hand is ${name}'s.`
  if (standing(hers) < 0) return 'The hand is yours.'
  if (winner === 'push') return `Both on ${totalWord(mine)}: a push, and nobody takes the hand.`
  return winner === 'reader'
    ? `Your ${totalWord(mine)} beats her ${totalWord(hers)}: the hand is yours.`
    : `Her ${totalWord(hers)} beats your ${totalWord(mine)}: the hand is ${name}'s.`
}

/** What a match comes to, as the scene's narration says it. */
export function matchSummary(name: string, mine: number, hers: number): string {
  const count = (a: number, b: number): string => `${a} hand${a === 1 ? '' : 's'} to ${b}`
  if (mine > hers) return `You play blackjack with ${name} and win, ${count(mine, hers)}.`
  if (mine < hers) return `You play blackjack with ${name} and lose, ${count(mine, hers)}.`
  return `You play blackjack with ${name} and it ends level, ${mine} hand${mine === 1 ? '' : 's'} each.`
}

/** One hand as the account tells it, and whether it was out of the ordinary. */
export interface HandTold {
  /** The hand in a line, each side's play with its judgment. */
  line: string
  /** Worth a remark at the table: a bust, a two-card 21, or a hand won by a single point. */
  notable: boolean
}

/** A list of totals said aloud: "12, 15 and 19". */
function totalsWord(totals: readonly number[]): string {
  return totals.length < 2
    ? totals.join('')
    : `${totals.slice(0, -1).join(', ')} and ${totals[totals.length - 1]}`
}

/**
 * The reader's side of a hand, judged. He plays without seeing her total, so drawing on a
 * middling hand is a fair risk whatever comes; what is his own doing is drawing on a hard 17 or
 * better, or standing on a total no card could have broken.
 */
function readerTold(hand: HandPlayed): string {
  if (isNatural(hand.mine)) return 'was dealt a two-card 21: luck, not play'
  const { total } = handTotal(hand.mine)
  const hits = hand.hits
  const last = hits[hits.length - 1]
  const rash = hits.some((hit) => !hit.soft && hit.total >= 17)
  const drew = hits.length ? `hit on ${totalsWord(hits.map((hit) => hit.total))} and ` : ''
  if (total > 21) {
    const note =
      !last.soft && last.total >= 17
        ? `a reckless call: almost nothing helps a ${last.total}`
        : last.total >= 15
          ? 'a gamble that failed'
          : 'a fair risk that failed: bad luck'
    return `${drew}bust with ${total}, ${note}`
  }
  const note = rash
    ? ', after a reckless draw that came off'
    : total <= 11
      ? ', a mistake: no card could have bust him'
      : ''
  return `${drew}stood on ${total}${note}`
}

/**
 * Her side of a hand, judged against the sound move at each step, which she could always work
 * out: she saw what she had to beat.
 */
function herTold(hand: HandPlayed): string {
  const mine = standing(hand.mine)
  const { total } = handTotal(hand.hers)
  if (mine < 0) return `had only to turn her card, holding ${total}`
  if (isNatural(hand.hers)) return 'turned over a two-card 21: luck, not play'
  if (mine === 22) return `could do nothing against it, holding ${total}`
  const moves = hand.herMoves
  const hits = moves.filter((made) => made.move === 'hit')
  const drew = hits.length ? `hit on ${totalsWord(hits.map((made) => made.total))} and ` : ''
  const greedy = moves.find((made) => made.move === 'hit' && made.sound === 'stand')
  const timid = moves.find((made) => made.move === 'stand' && made.sound === 'hit')
  if (total > 21) {
    return greedy
      ? `${drew}bust with ${total}, a mistake: she was already ahead on ${greedy.total} and threw the hand away`
      : `${drew}bust with ${total}, bad luck: she had to draw to beat his ${mine}`
  }
  const note = timid
    ? timid.total < mine
      ? `, a mistake: she was still behind his ${mine} and gave the hand up`
      : ', timid play: level with him on a total that was worth another card'
    : greedy
      ? `, after a needless draw when she was already ahead on ${greedy.total}`
      : ''
  return `${drew}stood on ${total}${note}`
}

/** Hand `no` of a match, counted from one, as the account tells it. */
export function handTold(name: string, hand: HandPlayed, no: number): HandTold {
  const [a, b] = [standing(hand.mine), standing(hand.hers)]
  const winner = handWinner(hand.mine, hand.hers)
  const close = a > 0 && b > 0 && a < 22 && b < 22 && Math.abs(a - b) === 1
  const result =
    winner === 'push'
      ? 'A push: nobody won it'
      : `${winner === 'reader' ? 'The reader' : name} won it${close ? ' by a single point' : ''}`
  return {
    line: `Hand ${no}: the reader ${readerTold(hand)}; ${name} ${herTold(hand)}. ${result}.`,
    notable: a < 0 || b < 0 || a === 22 || b === 22 || close
  }
}

/**
 * How a match against her went, hand by hand, for the scene's writer: what each did on what
 * total, with bad play told apart from bad luck, and the count of hands at the end.
 */
export function matchAccount(name: string, hands: readonly HandPlayed[], agreed: number): string[] {
  const { mine, hers } = handsWon(hands)
  return [
    `It was heads-up blackjack over ${agreed} hand${agreed === 1 ? '' : 's'}, no dealer. The reader played each hand first without seeing ${name}'s face-down card; she then played knowing his total. Equal totals are a push.`,
    ...hands.map((hand, i) => handTold(name, hand, i + 1).line),
    ...(hands.length < agreed ? ['The match stopped there: the lead could no longer be caught.'] : []),
    `Final count of hands: the reader ${mine}, ${name} ${hers}.`
  ]
}
