import { describe, expect, it } from 'vitest'
import { callWins, freshDeck, herCall, type Card } from '../src/shared/highLow'

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
})
