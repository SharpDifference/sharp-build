import { gamesOffered, type MiniGameDef } from '@shared/minigames'
import type { SceneLine } from '@shared/types'
import { useGameStore } from '../stores/gameStore'
import { submitAction, takeTurnFromReply } from '../stores/gameLoop'
import { advance } from '../stores/loop/hooks'
import { replyRowOfferOf } from '../stores/loop/playback'
import { useModsStore, modIsOn } from '../stores/modsStore'
import { splitOverflow } from '../stores/sceneSanitizer'
import { boxFits } from '../views/boxRows'
import { gameComponent, type PlayResult } from './play'
import { useTableStore } from './session'

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

/** The girls in the scene, by id: the cast, less whoever has left it. */
export function usePresentGirls(): string[] {
  const cast = useGameStore((s) => s.cast)
  const departed = useGameStore((s) => s.departed)
  return cast.filter((id) => !departed.includes(id))
}

/** What the reader calls a girl: her first name once he has been told it, "her" until then. */
export function nameOf(charId: string): string {
  const game = useGameStore.getState()
  const known = game.charInfo[charId]?.nameKnown
  return (known && game.characters[charId]?.firstName) || 'her'
}

/** The reader is standing at his own turn, with nothing left to read. */
export function useAtTurn(): boolean {
  return useGameStore((s) => s.awaitingInput && !s.busy && s.pendingLines.length === 0)
}

/**
 * Asks a girl to play, as the reader's turn in the scene: over a reply still being read it is an
 * interjection. Her answer comes back with the reply. False where no turn could be taken.
 */
export function proposeGame(gameId: string, charId: string, words: string): boolean {
  const text = words.trim()
  if (!text || !takeTurnFromReply()) return false
  useTableStore.getState().setProposal({ gameId, charId, text })
  void submitAction(text)
  return true
}

/**
 * The reader may start a game: wherever he may take a turn. That is his own turn, and also over
 * a reply he is still reading, on the terms an interjection is let through on.
 */
export function useTableOpen(): boolean {
  return useGameStore((s) => {
    if (s.replaying || s.sceneQuiz) return false
    if (s.awaitingInput && !s.busy && s.pendingLines.length === 0) return true
    return replyRowOfferOf(s) === 'open'
  })
}

/**
 * Takes the turn for a game, as an interjection does: the lines of the reply not yet read are
 * dropped, and the scene stands at a decision point. Nothing to do where it already does.
 */
export function takeTurnForGame(): boolean {
  return takeTurnFromReply()
}

/**
 * Puts a finished game into the scene as narration, over whatever of the reply was still unread: on the transcript, where the next reply, the
 * scene's summary and its bookkeeping all read it, and on the box, where the reader does. Reading
 * past it reaches the decision point again, which writes the scene with the game in it.
 */
export function fileResult(result: PlayResult, stake = ''): void {
  // The game's first move took the turn; a result filed without one takes it here.
  if (!takeTurnForGame()) return
  const riding = stake ? ` Riding on it: ${stake}` : ''
  const line: SceneLine = { speaker: '', text: `${result.summary}${riding}` }
  const lines = splitOverflow(line, boxFits)
  const game = useGameStore.getState()
  game.appendSceneLines(lines)
  game.appendPendingLines(lines)
  game.setAwaitingInput(false)
  advance()
}
