import BOWLING from '@shared/minigameEntries/bowling'
import { Bowling } from '../minigames/Bowling'
import { registerGame } from '../minigames/play'

registerGame(BOWLING.id, Bowling)
