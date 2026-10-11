import { MINI_GAMES } from '../minigames'
import BEER_PONG from '../minigameEntries/beer-pong'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: BEER_PONG.modId,
  name: 'Beer Pong',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Two racks of cups, a ball and a steadily less steady hand: aim, lob, and make them drink. At the bar, the dorms, the clubs and your room.',
  requires: [MINI_GAMES]
}

export default def
