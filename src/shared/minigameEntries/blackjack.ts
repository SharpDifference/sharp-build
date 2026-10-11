import type { MiniGameDef } from '../minigames'

const BLACKJACK: MiniGameDef = {
  id: 'blackjack',
  modId: 'morrowkiln-card-games',
  name: 'Blackjack',
  icon: '♠️',
  blurb:
    'blackjack with no dealer, heads-up or around a table: everyone draws towards 21 without going over, and the closest hand wins',
  format:
    'A game is a set number of hands from one deck between the reader and every girl playing, each for herself, and whoever wins the most hands takes it; level at the top is a draw, and it stops early once the leader cannot be caught by anyone. Each hand everyone gets two cards, each girl with one face down; the reader hits or stands first, then each girl in turn turns her card and plays knowing the hands finished before hers. The best hand not over 21 wins the hand, and a best hand that is shared, or everyone going over, is a push that nobody wins. Aces count 11 or 1 and face cards 10, and a 21 in two cards beats a 21 made with more.',
  options: [
    {
      id: 'hands',
      describe: 'how many hands the game is played over, whoever is playing',
      min: 1,
      max: 5,
      default: 3
    }
  ],
  // A deck in a pocket: it comes up where people sit around with time to spare, and seldom elsewhere.
  suggest: 'rarely',
  suggestAt: { cutetea: 'sometimes', lowrise_dorms: 'sometimes', room: 'sometimes' },
  players: { min: 1, max: 3 },
  surface: 'table',
  skillBrief:
    'A good player knows the total she has to beat and when another card is worth the risk of going over; a poor one stands out of nerves or draws out of greed.'
}

export default BLACKJACK
