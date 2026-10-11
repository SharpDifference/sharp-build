import { MINI_GAMES } from '@shared/minigames'
import { MiniGamePanel } from '../minigames/MiniGamePanel'
import { MiniGameSeat } from '../minigames/MiniGameSeat'
import { registerHooks } from '../mods/hooks'

registerHooks(MINI_GAMES, { scenePlay: { Seat: MiniGameSeat, Panel: MiniGamePanel } })
