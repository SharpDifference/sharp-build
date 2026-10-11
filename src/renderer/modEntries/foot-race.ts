import FOOT_RACE from '@shared/minigameEntries/foot-race'
import { FootRace } from '../minigames/FootRace'
import { registerGame } from '../minigames/play'

registerGame(FOOT_RACE.id, FootRace)
