import type { MiniGameDef } from '../minigameKit'

const POOL: MiniGameDef = {
  id: 'pool',
  modId: 'morrowkiln-arcade-games',
  name: 'Pool',
  icon: '🎱',
  blurb:
    'eight-ball on a pool table: each player pots their seven balls, solids or stripes, and then the black eight',
  format:
    'Eight-ball, played in turns on one table. The reader breaks the first rack and the break alternates after it. The table is open until someone pots a ball, and the first ball potted makes that player solids or stripes for the rack; an eight that drops on the break is put back. A player who pots one of their own balls shoots again, otherwise the turn passes. Potting the cue ball, hitting nothing, or hitting the wrong ball first (the other group, or the eight too soon) is a foul: the turn passes and the other player places the cue ball anywhere. Whoever clears their group and then pots the eight wins the rack; potting the eight early, fouling on the shot that pots it, or potting the cue ball when shooting at the eight loses it, so a rack always has a winner. Shots are not called and there are no safeties to declare. It is one rack unless they agree best of three. Alone, the reader simply clears the table and counts his shots.',
  options: [
    {
      id: 'race',
      describe:
        'how many racks win the match: 1 is a single rack, 2 is best of three racks (first to two)',
      min: 1,
      max: 2,
      default: 1
    }
  ],
  // Where a table stands: the bar and the student lounge, the dorm common room, the club's back room.
  locations: ['stalestein_bar', 'pino_cola_lounge', 'lowrise_dorms', 'apogee_club'],
  suggest: 'sometimes',
  suggestAt: {
    stalestein_bar: 'often',
    pino_cola_lounge: 'often',
    lowrise_dorms: 'sometimes',
    apogee_club: 'sometimes'
  },
  players: { min: 0, max: 1 },
  surface: 'board',
  controls: 'Aim with the pointer, hold to set the power, let go to shoot.',
  skillBrief:
    'A good player picks the shot that is on, cues straight with the right weight and strings several pots together; a poor one takes on hard cuts, misses by a ball\'s width and sometimes sends the cue ball into a pocket.'
}

export default POOL
