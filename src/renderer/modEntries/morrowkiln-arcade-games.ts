import AIR_HOCKEY from '@shared/minigameEntries/air-hockey'
import { AirHockey } from '../minigames/AirHockey'
import PARADISO from '@shared/minigameEntries/paradiso'
import { Paradiso } from '../minigames/Paradiso'
import POOL from '@shared/minigameEntries/pool'
import { Pool } from '../minigames/Pool'
import BOWLING from '@shared/minigameEntries/bowling'
import { Bowling } from '../minigames/Bowling'
import { registerGame } from '../minigames/play'

registerGame(AIR_HOCKEY.id, AirHockey)
registerGame(PARADISO.id, Paradiso)
registerGame(POOL.id, Pool)
registerGame(BOWLING.id, Bowling)
