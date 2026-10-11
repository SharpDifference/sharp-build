import type { MiniGameDef } from '../minigameKit'

const HIGH_LOW: MiniGameDef = {
  id: 'high-low',
  modId: 'morrowkiln-card-games',
  name: 'High-Low',
  icon: '🃏',
  blurb:
    'a quick card game: a card is turned face up and the player calls whether the next is higher or lower',
  format:
    'One deck. A card is face up; the player whose turn it is calls whether the next card will be higher or lower, the card is turned, and a right call scores. The two take turns, the reader first, each making the same number of calls, and the better count wins; level counts are a draw. In sudden death they keep going a call each at a time until one is ahead after equal turns, so there is always a winner. Twos are low, aces high, and the same rank again is a miss.',
  options: [
    {
      id: 'calls',
      label: 'Calls each',
      describe: 'how many calls each player makes in a normal game',
      min: 1,
      max: 5,
      default: 5
    },
    {
      id: 'sudden',
      label: 'Sudden death',
      describe:
        'sudden death, which is how a tiebreak or a death match is played: 1 to play it, 0 for a normal game. In sudden death the two make one call each, again and again, until one of them is ahead after both have had the same number of calls; "calls" is then ignored',
      values: { 0: 'A normal game', 1: 'Sudden death' },
      min: 0,
      max: 1,
      default: 0
    }
  ],
  // A deck in a pocket: it comes up where people sit around with time to spare, and seldom elsewhere.
  suggest: 'rarely',
  suggestAt: { cutetea: 'sometimes', lowrise_dorms: 'sometimes', room: 'sometimes' },
  players: { min: 0, max: 1 },
  controls: 'Click Higher or Lower.',
  skillBrief:
    'A good player keeps track of the cards already turned and calls with the odds; a poor one goes on hunches.'
}

export default HIGH_LOW
