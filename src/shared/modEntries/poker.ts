import { MINI_GAMES } from '../minigames'
import POKER from '../minigameEntries/poker'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: POKER.modId,
  name: 'Poker',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: "Texas hold'em for play chips with one to three girls: a few hands, most chips wins. Playable anywhere.",
  requires: [MINI_GAMES]
}

export default def
