import { describe, expect, it } from 'vitest'
import { callWins, herCall, versusOver } from '../src/shared/minigameRules/highLow'
import { freshDeck, type Card } from '../src/shared/minigameKit'

/** High-Low's rules: what a call wins on, and the deck it is played from. */

const card = (rank: number): Card => ({ rank, suit: 'spades' })

describe('High-Low', () => {
  it('counts a card of the same rank as a miss whichever way the call went', () => {
    expect(callWins(card(7), card(7), 'higher')).toBe(false)
    expect(callWins(card(7), card(7), 'lower')).toBe(false)
    expect(callWins(card(7), card(8), 'higher')).toBe(true)
    expect(callWins(card(7), card(8), 'lower')).toBe(false)
    expect(callWins(card(14), card(2), 'lower')).toBe(true)
  })

  it('plays from all fifty-two cards, each once', () => {
    const deck = freshDeck()
    expect(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size).toBe(52)
  })

  it('has every girl read an obvious card, and only a sharp one read a close one', () => {
    const king = card(13)
    const eight = card(8)
    const never = (): number => {
      throw new Error('guessed')
    }
    // A king is lower for anyone, with no guess taken.
    expect(herCall(king, [king], 1, never)).toBe('lower')
    // An eight with two low cards gone leans higher by a hair: the sharpest reads it, the
    // weakest guesses.
    const seen = [eight, card(2), card(3)]
    expect(herCall(eight, seen, 5, never)).toBe('higher')
    expect(herCall(eight, seen, 1, () => 0)).toBe('higher')
    expect(herCall(eight, seen, 1, () => 0.9)).toBe('lower')
  })

  it('ends sudden death only when one is ahead after equal turns', () => {
    const call = (hers: boolean, right: boolean) => ({ hers, call: 'higher' as const, right })
    // He is ahead, but she has not had her call.
    expect(versusOver([call(false, true)], 5, true)).toBe(false)
    // Level after a call each: on they go.
    expect(versusOver([call(false, true), call(true, true)], 5, true)).toBe(false)
    expect(versusOver([call(false, false), call(true, false)], 5, true)).toBe(false)
    // Ahead after equal turns: over, however few calls it took.
    expect(versusOver([call(false, false), call(true, true)], 5, true)).toBe(true)
    // A normal game runs its length whatever the count.
    expect(versusOver([call(false, false), call(true, true)], 5, false)).toBe(false)
  })
})
