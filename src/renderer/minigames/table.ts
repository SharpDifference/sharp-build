import { gamesOffered, type MiniGameDef } from '@shared/minigames'
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
 * The scene has nothing more to offer a game: it has resolved into its closing bookkeeping, or the
 * playthrough is over. The seat is then absent, where a turn merely out leaves it standing dim.
 */
export function useSceneSpent(): boolean {
  return useGameStore((s) => s.statusShown || s.statusModal !== null || s.activeGameOver !== null)
}

/**
 * Takes the turn for a game, as an interjection does: the lines of the reply not yet read are
 * dropped, and the scene stands at a decision point. Nothing to do where it already does.
 */
export function takeTurnForGame(): boolean {
  return takeTurnFromReply()
}

/**
 * Brings the scene to the reader's turn for something the table is about to send. At his turn
 * already, nothing to do; over a reply, the interjection's own steps. A table that has been
 * narrating stands on its own last line with nothing behind it, and where the scene will not
 * count that as a turn to take (a class scene's opening), the turn is simply opened.
 */
function reachTurn(): boolean {
  const game = useGameStore.getState()
  if (game.awaitingInput && !game.busy && game.pendingLines.length === 0) return true
  if (takeTurnFromReply()) return true
  if (game.busy || game.streaming || game.pendingLines.length > 0) return false
  game.setAwaitingInput(true)
  return true
}

/** Puts lines on the transcript and on the box at once, the box turning to the first of them. */
function playLines(text: string): void {
  const lines = splitOverflow({ speaker: '', text }, boxFits)
  const game = useGameStore.getState()
  game.appendSceneLines(lines)
  game.appendPendingLines(lines)
  game.setAwaitingInput(false)
  advance()
}

/** A line from the table in the scene's dialogue box, once the turn is the table's. */
export function narrateAtTable(text: string): void {
  playLines(text)
}

/** Who a game was played with and for what, as far as filing its result goes. */
export interface PlayedWith {
  game: MiniGameDef
  /** What the reader calls each girl who played. */
  names: readonly string[]
  stake: string
}

/**
 * Puts a finished game into the scene, over whatever of the reply was still unread.
 *
 * A game played alone is a line of narration: on the transcript, where the next reply, the
 * scene's summary and its bookkeeping all read it, and on the box, where the reader does; reading
 * past it is his turn again.
 *
 * A game played with a girl is the reader's turn itself: the result goes out as his action, so
 * her reaction is the next thing written, and what the game has to say about how it went rides
 * with that one request.
 */
export function fileResult(result: PlayResult, played: PlayedWith): void {
  // The game's first move took the turn, and its narration has stood on the box since.
  if (!reachTurn()) return

  if (played.names.length > 0) {
    const who = played.names.join(' and ')
    useTableStore.getState().setPlayed({
      text: result.summary,
      brief: [
        'MINI-GAME RESULT',
        `The reader and ${who} have just played ${played.game.name} for real, at the table, between your last lines and now. It is over and settled: do not replay it or change how it came out.`,
        ...(result.account ?? []),
        ...(played.stake
          ? [`Riding on it, as they agreed: ${played.stake} It is owed now.`]
          : []),
        `Open on the result, then let ${who} react to it in character: how the game went, anything in it worth a remark, and the stake if there was one.`
      ]
    })
    void submitAction(result.summary)
    return
  }

  playLines(result.summary)
}
