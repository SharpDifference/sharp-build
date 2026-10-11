import { MINI_GAMES } from '../minigames'
import TRUTH_OR_DARE from '../minigameEntries/truth-or-dare'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: TRUTH_OR_DARE.modId,
  name: 'Truth or Dare',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'Truth or dare, with one girl or a table of them: she asks in her own words, you answer in yours, and the scene remembers what came out.',
  requires: [MINI_GAMES]
}

export default def
