import BLACKJACK from '@shared/minigameEntries/blackjack'
import { Blackjack } from '../minigames/Blackjack'
import { registerGame } from '../minigames/play'

registerGame(BLACKJACK.id, Blackjack)
