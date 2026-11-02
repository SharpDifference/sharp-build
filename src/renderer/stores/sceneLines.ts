import { isEmotion } from '@shared/emotions'
import { parseSpriteRef } from '@shared/outfits'
import { charKeyOf, type Emotion, type SceneLine } from '@shared/types'
import { boxFits } from '../views/boxRows'
import { takeTurnFromReply } from './gameLoop'
import { sceneWithout, useGameStore } from './gameStore'
import { advance } from './loop/hooks'
import { sceneInProgress } from './loop/stream'
import { modIsOn } from './modsStore'
import { splitOverflow } from './sceneSanitizer'
import { markTransient, transientOwner } from './transientLines'

/**
 * What a mod says into the scene from outside its replies, and the turn it takes to say it: the
 * lines go where the scene's own go, on the transcript every later request quotes and on the box
 * the reader reads, split as the scene's own are.
 */

/** Who says a mod's line, and whether it stays. */
export interface SceneLineOptions {
  /** A girl in the scene, whose line it is; narration without one. */
  charId?: string
  /** Her face as she says it, in the outfit she has on. */
  expression?: Emotion
  /** For the moment only: {@link dropTransientLines} takes it back, and no save keeps it. */
  transient?: boolean
}

/** A scene is running and still takes lines: not a replay, not its ending, not the game's end. */
function sceneTakesLines(): boolean {
  const game = useGameStore.getState()
  return sceneInProgress() && game.replaying === null && !game.sceneEnding && game.activeGameOver === null
}

/** A text split as the box needs it: each part fits the box, cut between sentences. */
export function boxParts(text: string): string[] {
  const words = text.trim()
  if (!words) return []
  return splitOverflow({ speaker: '', text: words }, boxFits).map((line) => line.text)
}

/**
 * Puts a mod's words on the scene: onto the transcript and the box at once, the box turning to
 * the first part, the reader's turn closed until it is read. False, with nothing said, where the
 * mod is off, the words are empty, no scene takes lines, or `charId` is not in the scene.
 */
export function sayInScene(modId: string, text: string, options: SceneLineOptions = {}): boolean {
  const words = text.trim()
  if (!modIsOn(modId) || !words || !sceneTakesLines()) return false
  const game = useGameStore.getState()
  let speaker = ''
  let actions: string[] | undefined
  if (options.charId !== undefined) {
    const character = game.characters[options.charId]
    if (!character || !game.cast.includes(options.charId)) return false
    speaker = charKeyOf(character.firstName, character.lastName)
    const { expression } = options
    if (expression !== undefined && isEmotion(expression)) {
      const outfit = parseSpriteRef(game.emotions[options.charId] ?? 'neutral')?.set
      actions = [`sprite:${speaker},${expression}${outfit ? `_${outfit}` : ''}`]
    } else if (expression !== undefined) {
      console.warn(`[mods] ${modId}: "${String(expression)}" is not a face, so her line keeps the one she has`)
    }
  }
  const lines: SceneLine[] = splitOverflow({ speaker, text: words, ...(actions ? { actions } : {}) }, boxFits)
  if (options.transient) markTransient(modId, lines)
  game.appendSceneLines(lines)
  game.appendPendingLines(lines)
  game.setAwaitingInput(false)
  advance()
  return true
}

/**
 * Takes a mod's transient lines back off the scene: off the transcript, the log and the queue,
 * wherever they have got to. Every other mod's lines, and the scene's own, stay. A box showing
 * one of them lands at once on the last line kept.
 */
export function dropTransientLines(modId: string): void {
  const game = useGameStore.getState()
  const patch = sceneWithout(game, (line) => transientOwner(line) === modId)
  if (!patch) return
  const moved = patch.currentLine !== game.currentLine
  useGameStore.setState(moved ? { ...patch, lineRewound: game.lineRewound + 1 } : patch)
}

/**
 * Brings the scene to the reader's turn. At his turn already, nothing to do; over a reply, an
 * interjection's own steps (see `takeTurnFromReply`). A scene left standing on a mod's last line,
 * with nothing behind it and not counted as a turn to take, as at a class scene's opening, has
 * its turn opened. False, with nothing changed, where the scene takes no lines (its ending among
 * them) or is busy.
 */
export function reachTurn(): boolean {
  if (!sceneTakesLines()) return false
  const game = useGameStore.getState()
  if (game.awaitingInput && !game.busy && game.pendingLines.length === 0) return true
  if (takeTurnFromReply()) return true
  if (game.busy || game.streaming || game.pendingLines.length > 0) return false
  game.setAwaitingInput(true)
  return true
}

/**
 * The reader's words onto the scene as his own, with nobody asked to answer: on the transcript
 * and the log, as an action he took inside the scene. False where the words are empty or no
 * scene takes lines.
 */
export function readerSaysInScene(text: string): boolean {
  const words = text.trim()
  if (!words || !sceneTakesLines()) return false
  useGameStore.getState().logPlayerAction(words, true)
  return true
}
