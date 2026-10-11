import BEER_PONG from '@shared/minigameEntries/beer-pong'
import { BeerPong } from '../minigames/BeerPong'
import TRUTH_OR_DARE from '@shared/minigameEntries/truth-or-dare'
import { TruthOrDare } from '../minigames/TruthOrDare'
import { registerGame } from '../minigames/play'

registerGame(BEER_PONG.id, BeerPong)
registerGame(TRUTH_OR_DARE.id, TruthOrDare)
