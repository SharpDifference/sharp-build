import CAT_PAIRS from '@shared/minigameEntries/cat-pairs'
import { CatPairs } from '../minigames/CatPairs'
import { registerGame } from '../minigames/play'

registerGame(CAT_PAIRS.id, CatPairs)
