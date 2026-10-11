import SWIM_RACE from '@shared/minigameEntries/swim-race'
import { SwimRace } from '../minigames/SwimRace'
import { registerGame } from '../minigames/play'

registerGame(SWIM_RACE.id, SwimRace)
