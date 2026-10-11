import AIR_HOCKEY from '@shared/minigameEntries/air-hockey'
import { AirHockey } from '../minigames/games/AirHockey'
import PARADISO from '@shared/minigameEntries/paradiso'
import { Paradiso } from '../minigames/games/Paradiso'
import POOL from '@shared/minigameEntries/pool'
import { Pool } from '../minigames/games/Pool'
import BOWLING from '@shared/minigameEntries/bowling'
import { Bowling } from '../minigames/games/Bowling'
import { registerGame } from '../minigames/kit'

registerGame(AIR_HOCKEY.id, AirHockey)
registerGame(PARADISO.id, Paradiso)
registerGame(POOL.id, Pool)
registerGame(BOWLING.id, Bowling)
