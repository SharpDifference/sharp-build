import { MINI_GAMES } from '../minigames'
import PARADISO from '../minigameEntries/paradiso'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: PARADISO.modId,
  name: 'PARADISO',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'The dance machine at the BTB Arcade: four arrows, one song, alone or side by side with her on the second pad.',
  requires: [MINI_GAMES]
}

export default def
