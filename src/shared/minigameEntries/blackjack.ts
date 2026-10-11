import type { MiniGameDef } from '../minigames'

const BLACKJACK: MiniGameDef = {
  id: 'blackjack',
  modId: 'blackjack',
  name: 'Blackjack',
  icon: '♠️',
  blurb:
    'heads-up blackjack, no dealer: each draws towards 21 without going over, and the closer hand wins',
  format:
    'A match is a set number of hands from one deck, and whoever wins more of them takes it; level is a draw, and it stops early once one of them cannot be caught. Each hand both get two cards, hers with one face down; the reader hits or stands first and loses the hand at once if he goes over 21, then she turns her card and plays knowing his total. Closer to 21 wins the hand and equal totals are a push that nobody wins. Aces count 11 or 1 and face cards 10, and a 21 in two cards beats a 21 made with more.',
  options: [
    {
      id: 'hands',
      describe: 'how many hands the match is played over',
      min: 1,
      max: 5,
      default: 3
    }
  ],
  // A deck in a pocket: it comes up where people sit around with time to spare, and seldom elsewhere.
  suggest: 'rarely',
  suggestAt: { cutetea: 'sometimes', lowrise_dorms: 'sometimes', room: 'sometimes' },
  players: { min: 1, max: 1 },
  surface: 'table',
  skillBrief:
    'A good player knows the total she has to beat and when another card is worth the risk of going over; a poor one stands out of nerves or draws out of greed.'
}

export default BLACKJACK
