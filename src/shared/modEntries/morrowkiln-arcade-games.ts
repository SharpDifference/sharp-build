import { packMod } from '../minigameKit'
import AIR_HOCKEY from '../minigameEntries/air-hockey'
import PARADISO from '../minigameEntries/paradiso'
import POOL from '../minigameEntries/pool'
import BOWLING from '../minigameEntries/bowling'

/** A pack: one mod bringing several games, each with a switch of its own among the options. */
export default packMod({
  id: 'morrowkiln-arcade-games',
  name: "Morrowkiln's Arcade & Bar Games",
  author: 'morrowkiln',
  version: '0.1.0',
  blurb: 'What the arcade, the bar and the bowling alley are for.',
  games: [AIR_HOCKEY, PARADISO, POOL, BOWLING]
})
