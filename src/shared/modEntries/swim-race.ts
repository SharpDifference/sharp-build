import { MINI_GAMES } from '../minigames'
import SWIM_RACE from '../minigameEntries/swim-race'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: SWIM_RACE.modId,
  name: 'Swim Race',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'A race in the stadium pool or out to the buoy at the beach: stroke rhythm, breath and turns, alone against the clock or against up to three girls.',
  requires: [MINI_GAMES]
}

export default def
