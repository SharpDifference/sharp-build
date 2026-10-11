import { MINI_GAMES } from '../minigames'
import FOOT_RACE from '../minigameEntries/foot-race'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: FOOT_RACE.modId,
  name: 'Foot Race',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'A race on foot at the stadium track, the park, the quad or the beach: a sprint, a lap or two, alone against the clock or against up to three of the girls.',
  requires: [MINI_GAMES]
}

export default def
