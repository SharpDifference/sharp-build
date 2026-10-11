import type { MiniGameDef } from '../minigameKit'

const SWIM_RACE: MiniGameDef = {
  id: 'swim-race',
  modId: 'morrowkiln-sports',
  name: 'Swim Race',
  icon: '🏊',
  blurb:
    'a freestyle swimming race, side by side in the water: long even strokes, a breath at the right moment and a clean turn at each end',
  format:
    'A freestyle race over a set number of lengths: lengths of the pool at the stadium, and at the beach the same distance swum out to the buoy and back. Everyone racing dives in together on the whistle, each in a lane of their own, and turns at the end of every length; the first to touch at the end of the last length wins, and the others are placed by their times, to the hundredth of a second. Two who touch in the same hundredth share the place, and the reader sharing first is a draw. Alone the reader swims against the clock for a time. There are no heats, no handicaps and no other strokes.',
  options: [
    {
      id: 'lengths',
      describe:
        'how far the race is: 1 is two lengths, a sprint there and back, 2 is four lengths, 3 is six lengths, a long swim that tells on anyone unfit',
      min: 1,
      max: 3,
      default: 1
    }
  ],
  // Where there is water to race in: the stadium's pool, and the sea off the beach.
  locations: ['palaestra_stadium', 'selkie_beach'],
  suggest: 'sometimes',
  suggestAt: { palaestra_stadium: 'often', selkie_beach: 'sometimes' },
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls: 'Hold Space to pull and let go to glide. W breathes, S turns at the wall.',
  skillBrief:
    'A good swimmer has a long, even stroke learned in lessons or on a team, breathes without breaking her rhythm, turns cleanly and has the fitness to hold her pace to the end; a poor one thrashes, comes up gasping, fumbles her turns and fades after the first length.'
}

export default SWIM_RACE
