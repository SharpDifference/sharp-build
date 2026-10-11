import { MINI_GAMES } from '../minigames'
import BOWLING from '../minigameEntries/bowling'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: BOWLING.modId,
  name: 'Bowling',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Ten pins, a lane and a steady hand: set your spot, your power and your hook. At the bowling alley.',
  requires: [MINI_GAMES]
}

export default def
