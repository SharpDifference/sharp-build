import { describe, expect, it } from 'vitest'
import { callWins, freshDeck, type Card } from '../src/shared/highLow'

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
})
