import BEER_PONG from '@shared/minigameEntries/beer-pong'
import { BeerPong } from '../minigames/BeerPong'
import { registerGame } from '../minigames/play'

registerGame(BEER_PONG.id, BeerPong)
