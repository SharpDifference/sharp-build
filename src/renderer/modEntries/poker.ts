import POKER from '@shared/minigameEntries/poker'
import { Poker } from '../minigames/Poker'
import { registerGame } from '../minigames/play'

registerGame(POKER.id, Poker)
