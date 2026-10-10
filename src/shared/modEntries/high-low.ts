import { MINI_GAMES } from '../minigames'
import HIGH_LOW from '../minigameEntries/high-low'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: HIGH_LOW.modId,
  name: 'High-Low',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'A deck of cards and one question: is the next card higher or lower? Playable anywhere.',
  requires: [MINI_GAMES]
}

export default def
