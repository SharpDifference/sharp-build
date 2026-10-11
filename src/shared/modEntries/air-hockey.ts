import { MINI_GAMES } from '../minigames'
import AIR_HOCKEY from '../minigameEntries/air-hockey'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: AIR_HOCKEY.modId,
  name: 'Air Hockey',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'A puck, two mallets and a goal at each end, played for real against her. At the arcade, the student lounge and the pier.',
  requires: [MINI_GAMES]
}

export default def
