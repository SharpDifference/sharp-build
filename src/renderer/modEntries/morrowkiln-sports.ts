import FOOT_RACE from '@shared/minigameEntries/foot-race'
import { FootRace } from '../minigames/FootRace'
import SWIM_RACE from '@shared/minigameEntries/swim-race'
import { SwimRace } from '../minigames/SwimRace'
import ROLLER_DERBY from '@shared/minigameEntries/roller-derby'
import { RollerDerby } from '../minigames/RollerDerby'
import { registerGame } from '../minigames/play'

registerGame(FOOT_RACE.id, FootRace)
registerGame(SWIM_RACE.id, SwimRace)
registerGame(ROLLER_DERBY.id, RollerDerby)
