import HIGH_LOW from '@shared/minigameEntries/high-low'
import { HighLow } from '../minigames/HighLow'
import { registerGame } from '../minigames/play'

registerGame(HIGH_LOW.id, HighLow)
