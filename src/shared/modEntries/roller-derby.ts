import { MINI_GAMES } from '../minigames'
import ROLLER_DERBY from '../minigameEntries/roller-derby'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: ROLLER_DERBY.modId,
  name: 'Rink Race',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'A race on quad skates round the Starlight Roller Rink: stride in rhythm, lean through the bends, alone against the clock or against up to three girls.',
  requires: [MINI_GAMES]
}

export default def
