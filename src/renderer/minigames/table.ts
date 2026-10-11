import { gamesOffered, type MiniGameDef } from '@shared/minigames'
import type { SceneLine } from '@shared/types'
import { useGameStore } from '../stores/gameStore'
import { advance } from '../stores/loop/hooks'
import { useModsStore, modIsOn } from '../stores/modsStore'
import { splitOverflow } from '../stores/sceneSanitizer'
import { boxFits } from '../views/boxRows'
import { gameComponent, type PlayResult } from './play'

/** Where the framework meets the scene: what is on offer in it, and how a result goes into it. */

/** The games on offer in the scene on screen, each with a component to play it with. */
export function useGamesOffered(): MiniGameDef[] {
  const location = useGameStore((s) => s.sceneLocation)
  const girls = useGameStore((s) => s.cast.filter((id) => !s.departed.includes(id)).length)
  // Read so a switch moved mid-scene is answered at once.
  useModsStore((s) => s.switches)
  return gamesOffered({ location, girls }, (modId) => modIsOn(modId)).filter((game) =>
    Boolean(gameComponent(game.id))
  )
}

/** The reader may start a game: it is his turn, in a scene that keeps its books. */
export function useTableOpen(): boolean {
  return useGameStore(
    (s) => s.awaitingInput && !s.busy && !s.sceneQuiz && !s.replaying && !s.sceneEnding
  )
}

/**
 * Puts a finished game into the scene as narration: on the transcript, where the next reply, the
 * scene's summary and its bookkeeping all read it, and on the box, where the reader does. Reading
 * past it reaches the decision point again, which writes the scene with the game in it.
 */
export function fileResult(result: PlayResult): void {
  const line: SceneLine = { speaker: '', text: result.summary }
  const lines = splitOverflow(line, boxFits)
  const game = useGameStore.getState()
  game.appendSceneLines(lines)
  game.appendPendingLines(lines)
  game.setAwaitingInput(false)
  advance()
}
