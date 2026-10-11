import { MINI_GAMES } from '../minigames'
import CAT_PAIRS from '../minigameEntries/cat-pairs'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: CAT_PAIRS.modId,
  name: 'Cat Pairs',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    "A memory game with the café's cats on the cards, and a real one that walks over the table. Played at the Purr & Pour Cat Café and at Cute Tea, alone or with up to three girls.",
  requires: [MINI_GAMES]
}

export default def
