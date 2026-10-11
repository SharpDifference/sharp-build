import AIR_HOCKEY from '@shared/minigameEntries/air-hockey'
import { AirHockey } from '../minigames/AirHockey'
import { registerGame } from '../minigames/play'

registerGame(AIR_HOCKEY.id, AirHockey)
