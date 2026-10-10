import type { MiniGameDef } from '../minigames'

const HIGH_LOW: MiniGameDef = {
  id: 'high-low',
  modId: 'high-low',
  name: 'High-Low',
  icon: '🃏',
  blurb:
    'a quick card game: a card is turned face up and the player calls whether the next is higher or lower',
  players: { min: 0, max: 1 },
  skillBrief:
    'A good player keeps track of the cards already turned and calls with the odds; a poor one goes on hunches.'
}

export default HIGH_LOW
