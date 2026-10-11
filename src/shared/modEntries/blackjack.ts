import { MINI_GAMES } from '../minigames'
import BLACKJACK from '../minigameEntries/blackjack'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: BLACKJACK.modId,
  name: 'Blackjack',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Heads-up blackjack over a few hands, no dealer: closest to 21 wins. Playable anywhere.',
  requires: [MINI_GAMES]
}

export default def
