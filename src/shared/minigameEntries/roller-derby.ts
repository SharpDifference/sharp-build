import type { MiniGameDef } from '../minigameKit'

const ROLLER_DERBY: MiniGameDef = {
  id: 'roller-derby',
  modId: 'morrowkiln-sports',
  name: 'Rink Race',
  icon: '🛼',
  blurb:
    'a race on quad skates round the roller rink\'s oval: steady alternating strides for speed, a lean through each bend, first one home',
  format:
    'A race of a set number of laps round the rink\'s oval, everyone starting together from the line. Speed comes from pushing off left and right in turn at a steady tempo: a stride off the tempo, rushed, or off the same foot twice loses speed. Each lap has two bends, and a skater leans through a bend to hold the racing line; without the lean she slides wide and loses time, and reaching the boards at speed is a fall, a second and a half on the floor before she is up again. Passing in a bend while off the line can clip the other skater and cost a little speed. Alone the reader skates the laps for a time. With one to three girls everyone races at once and the first across the line wins; the same time to the hundredth of a second is a dead heat. Anyone still out half a minute a lap after the start is called off and placed last.',
  options: [
    {
      id: 'laps',
      describe: 'how many laps the race is, a lap taking ten to fifteen seconds',
      min: 2,
      max: 6,
      default: 3
    }
  ],
  // The rink is City Life's; it is what people go there for.
  locations: ['roller_rink'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls: 'Alternate Left and Right in time with the pulse. Hold Down or S through the bends.',
  skillBrief:
    'A good skater has balance, rhythm and strong legs, has skated or danced or played a sport before, and leans into a bend without thinking; a poor one is stiff, unfit or new to skates, loses her stride, takes the bends wide and ends up on the floor.'
}

export default ROLLER_DERBY
