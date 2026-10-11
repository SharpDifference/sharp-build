import TRUTH_OR_DARE from '@shared/minigameEntries/truth-or-dare'
import { TruthOrDare } from '../minigames/TruthOrDare'
import { registerGame } from '../minigames/play'

registerGame(TRUTH_OR_DARE.id, TruthOrDare)
