import { MINI_GAMES } from '../minigames'
import POOL from '../minigameEntries/pool'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: POOL.modId,
  name: 'Pool',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'Eight-ball on a real table: aim, weigh the shot and pot your group before she pots hers, or clear the table alone. At the bar, the student lounge, the dorms and the club.',
  requires: [MINI_GAMES]
}

export default def
