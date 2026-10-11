import { describe, expect, it } from 'vitest'
import {
  dealLine,
  drawCard,
  handTold,
  handTotal,
  handWinner,
  handsWon,
  herMove,
  isNatural,
  matchAccount,
  matchOver,
  matchSummary,
  resultLine,
  soundMove,
  type HandPlayed
} from '../src/shared/blackjack'
import type { Card } from '../src/shared/highLow'
import { MINI_GAMES, MINI_GAMES_LIST, settledOptions } from '../src/shared/minigames'

/** Blackjack's rules: what a hand is worth, which hand wins, and how she plays hers. */

const hand = (...ranks: number[]): Card[] => ranks.map((rank) => ({ rank, suit: 'spades' }))

const never = (): number => {
  throw new Error('guessed')
}

describe('Blackjack', () => {
  it('counts each ace as eleven only while the hand stays at 21 or under', () => {
    expect(handTotal(hand(14, 6))).toEqual({ total: 17, soft: true })
    expect(handTotal(hand(14, 6, 13))).toEqual({ total: 17, soft: false })
    expect(handTotal(hand(14, 14, 9))).toEqual({ total: 21, soft: true })
    expect(handTotal(hand(12, 13, 5)).total).toBe(25)
  })

  it('puts a two-card 21 over a longer one, and loses the reader his bust whatever she holds', () => {
    expect(handWinner(hand(14, 13), hand(7, 7, 7))).toBe('reader')
    expect(handWinner(hand(10, 5, 6), hand(14, 12))).toBe('her')
    expect(handWinner(hand(10, 9), hand(9, 10))).toBe('push')
    expect(handWinner(hand(10, 9, 5), hand(10, 9, 5))).toBe('her')
  })

  it('has the best player draw until she is ahead and no further', () => {
    const his = hand(10, 8)
    expect(soundMove(hand(10, 7), his)).toBe('hit')
    expect(soundMove(hand(10, 9), his)).toBe('stand')
    // Level: worth a card on fourteen, not on eighteen.
    expect(soundMove(hand(10, 4), hand(8, 6))).toBe('hit')
    expect(soundMove(hand(10, 8), his)).toBe('stand')
    // He has bust, or holds a two-card 21 she cannot catch: she leaves her hand alone.
    expect(soundMove(hand(2, 3), hand(10, 6, 9))).toBe('stand')
    expect(soundMove(hand(10, 6), hand(14, 13))).toBe('stand')
    expect(herMove(hand(10, 7), his, 5, never)).toBe('hit')
  })

  it('has a weak player lose her nerve or overreach, and only where a person would', () => {
    const his = hand(10, 8)
    // Behind on a hand a card could break: she may stand on it.
    expect(herMove(hand(10, 5), his, 1, () => 0)).toBe('stand')
    expect(herMove(hand(10, 5), his, 1, () => 0.9)).toBe('hit')
    // The same roll does not catch a better player.
    expect(herMove(hand(10, 5), his, 4, () => 0.2)).toBe('hit')
    // Behind on a hand no card can break: nobody stands.
    expect(herMove(hand(5, 4), his, 1, never)).toBe('hit')
    // Ahead on a middling hand she may draw again; on a strong one she never does.
    expect(herMove(hand(10, 6), hand(10, 5), 1, () => 0)).toBe('hit')
    expect(herMove(hand(10, 10), his, 1, never)).toBe('stand')
    expect(herMove(hand(10, 2), hand(10, 6, 9), 1, never)).toBe('stand')
  })

  it('ends the match once the lead cannot be caught', () => {
    expect(matchOver(2, 0, 2, 3)).toBe(true)
    expect(matchOver(1, 0, 2, 3)).toBe(false)
    expect(matchOver(1, 1, 3, 3)).toBe(true)
    // Two pushes and a hand in hand: one behind with one to play is still alive.
    expect(matchOver(0, 1, 4, 5)).toBe(false)
  })

  it('knows a two-card 21 from any other, and calls level hands a push', () => {
    expect(isNatural(hand(14, 12))).toBe(true)
    expect(isNatural(hand(7, 7, 7))).toBe(false)
    expect(isNatural(hand(14, 9))).toBe(false)
    expect(handWinner(hand(14, 10), hand(14, 13))).toBe('push')
    expect(handWinner(hand(7, 7, 7), hand(10, 5, 6))).toBe('push')
    expect(handWinner(hand(10, 10), hand(10, 6, 9))).toBe('reader')
  })

  it('draws from the top, and cuts a new deck when the old one runs out', () => {
    const [top, rest] = drawCard(hand(5, 9))
    expect(top.rank).toBe(5)
    expect(rest.map((c) => c.rank)).toEqual([9])
    const [, fresh] = drawCard([], () => 0.5)
    expect(fresh.length).toBe(51)
  })

  it('slips more often the weaker she is, and never at her best', () => {
    // A seeded roll, so the same hands are played the same way every run.
    const seeded = (seed: number) => (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    const his = hand(10, 8)
    const slips = ([1, 2, 3, 4, 5] as const).map((skill) => {
      const rand = seeded(7)
      let wrong = 0
      for (let i = 0; i < 400; i++) {
        // Behind on fifteen, where a card is right, and ahead on sixteen, where it is not.
        if (herMove(hand(10, 5), his, skill, rand) !== 'hit') wrong++
        if (herMove(hand(10, 6), hand(10, 5), skill, rand) !== 'stand') wrong++
      }
      return wrong
    })
    expect(slips[4]).toBe(0)
    for (let i = 0; i < 4; i++) expect(slips[i]).toBeGreaterThan(slips[i + 1])
  })

  it('counts the hands each has won, pushes to nobody', () => {
    const played = (mine: Card[], hers: Card[]): HandPlayed => ({ mine, hers, hits: [], herMoves: [] })
    const hands = [
      played(hand(10, 10), hand(10, 9)),
      played(hand(10, 8), hand(10, 8)),
      played(hand(10, 6, 9), hand(5, 5))
    ]
    expect(handsWon(hands)).toEqual({ mine: 1, hers: 1 })
    expect(matchOver(1, 1, 3, 3)).toBe(true)
  })

  it('says the deal, the result and the match as the scene narrates them', () => {
    expect(dealLine('Mio', 2, hand(13, 6), hand(9)[0])).toBe(
      'Hand 2. You are dealt a king and a six: 16. Mio shows a nine, her other card face down.'
    )
    expect(resultLine('Mio', hand(10, 6, 9), hand(5, 5))).toBe("The hand is Mio's.")
    expect(resultLine('Mio', hand(10, 9), hand(10, 6, 9))).toBe('The hand is yours.')
    expect(resultLine('Mio', hand(10, 9), hand(10, 9))).toContain('a push')
    expect(resultLine('Mio', hand(14, 13), hand(7, 7, 7))).toBe(
      'Your 21 in two cards beats her 21: the hand is yours.'
    )
    expect(matchSummary('Mio', 2, 1)).toBe('You play blackjack with Mio and win, 2 hands to 1.')
    expect(matchSummary('Mio', 0, 1)).toBe('You play blackjack with Mio and lose, 0 hands to 1.')
    expect(matchSummary('Mio', 1, 1)).toBe('You play blackjack with Mio and it ends level, 1 hand each.')
  })

  it('tells bad play from bad luck in the account', () => {
    // He drew on a hard eighteen and went over; she never had to play.
    const reckless: HandPlayed = {
      mine: hand(10, 8, 9),
      hers: hand(10, 2),
      hits: [{ total: 18, soft: false }],
      herMoves: []
    }
    // He stood on twenty; she drew to 21 from behind: one point in it.
    const beaten: HandPlayed = {
      mine: hand(10, 10),
      hers: hand(10, 6, 5),
      hits: [],
      herMoves: [
        { move: 'hit', total: 16, sound: 'hit' },
        { move: 'stand', total: 21, sound: 'stand' }
      ]
    }
    // She stood on fifteen while still behind his eighteen.
    const timid: HandPlayed = {
      mine: hand(10, 8),
      hers: hand(10, 5),
      hits: [],
      herMoves: [{ move: 'stand', total: 15, sound: 'hit' }]
    }
    // She was ahead on sixteen, drew anyway and went over.
    const greedy: HandPlayed = {
      mine: hand(10, 5),
      hers: hand(10, 6, 10),
      hits: [],
      herMoves: [{ move: 'hit', total: 16, sound: 'stand' }]
    }
    const first = handTold('Mio', reckless, 1)
    expect(first.line).toContain('hit on 18 and bust with 27, a reckless call')
    expect(first.line).toContain('Mio had only to turn her card, holding 12')
    expect(first.notable).toBe(true)
    const second = handTold('Mio', beaten, 2)
    expect(second.line).toContain('the reader stood on 20')
    expect(second.line).toContain('Mio hit on 16 and stood on 21')
    expect(second.line).toContain('Mio won it by a single point')
    expect(handTold('Mio', timid, 3).line).toContain('a mistake: she was still behind his 18')
    expect(handTold('Mio', greedy, 4).line).toContain('she was already ahead on 16 and threw the hand away')

    const account = matchAccount('Mio', [reckless, beaten], 3)
    expect(account[0]).toContain('over 3 hands')
    expect(account).toHaveLength(5)
    expect(account[3]).toBe('The match stopped there: the lead could no longer be caught.')
    expect(account[4]).toBe('Final count of hands: the reader 0, Mio 2.')
    const full = matchAccount('Mio', [timid, greedy, beaten], 3)
    expect(full).toHaveLength(5)
    expect(full[4]).toBe('Final count of hands: the reader 2, Mio 1.')
  })

  it('is one of the games this build carries, three hands where nothing was said', () => {
    const def = MINI_GAMES_LIST.find((game) => game.id === 'blackjack')
    expect(def).toBeDefined()
    expect(def?.players).toEqual({ min: 1, max: 1 })
    expect(def?.modId).not.toBe(MINI_GAMES)
    expect(settledOptions(def!, {})).toEqual({ hands: 3 })
    expect(settledOptions(def!, { hands: 5 })).toEqual({ hands: 5 })
    expect(settledOptions(def!, { hands: 9 })).toEqual({ hands: 3 })
  })
})
