import HIGH_LOW from '@shared/minigameEntries/high-low'
import { HighLow } from '../minigames/HighLow'
import BLACKJACK from '@shared/minigameEntries/blackjack'
import { Blackjack } from '../minigames/Blackjack'
import POKER from '@shared/minigameEntries/poker'
import { Poker } from '../minigames/Poker'
import CAT_PAIRS from '@shared/minigameEntries/cat-pairs'
import { CatPairs } from '../minigames/CatPairs'
import { registerGame } from '../minigames/play'

registerGame(HIGH_LOW.id, HighLow)
registerGame(BLACKJACK.id, Blackjack)
registerGame(POKER.id, Poker)
registerGame(CAT_PAIRS.id, CatPairs)
