import type { MiniGameDef } from '../minigames'

const HIGH_LOW: MiniGameDef = {
  id: 'high-low',
  modId: 'high-low',
  name: 'High-Low',
  icon: '🃏',
  blurb:
    'a quick card game: a card is turned face up and the player calls whether the next is higher or lower',
  format:
    'One deck. A card is face up; the player whose turn it is calls whether the next card will be higher or lower, the card is turned, and a right call scores. The two take turns, the reader first, each making the same number of calls, and the better count wins; level counts are a draw. Twos are low, aces high, and the same rank again is a miss.',
  options: [
    {
      id: 'calls',
      describe:
        'how many calls each player makes; a single call each is how a tiebreak is played',
      min: 1,
      max: 5,
      default: 5
    }
  ],
  // A deck in a pocket: it comes up where people sit around with time to spare, and seldom elsewhere.
  suggest: 'rarely',
  suggestAt: { cutetea: 'sometimes', lowrise_dorms: 'sometimes', room: 'sometimes' },
  players: { min: 0, max: 1 },
  skillBrief:
    'A good player keeps track of the cards already turned and calls with the odds; a poor one goes on hunches.'
}

export default HIGH_LOW
