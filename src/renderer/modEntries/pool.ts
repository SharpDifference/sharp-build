import POOL from '@shared/minigameEntries/pool'
import { Pool } from '../minigames/Pool'
import { registerGame } from '../minigames/play'

registerGame(POOL.id, Pool)
