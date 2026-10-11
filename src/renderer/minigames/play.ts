import type { ComponentType } from 'react'
import type { Chattiness } from '@shared/minigames'

/**
 * What a mini-game is to the framework while it is being played: a component handed a
 * {@link GamePlay}, which is everything it may ask of the scene it is played in. What goes on
 * inside the component is the pack's own business.
 */

/** How a game came out. `played` is a game with nobody to beat. */
export type PlayOutcome = 'won' | 'lost' | 'draw' | 'played' | 'abandoned'

export interface PlayResult {
  outcome: PlayOutcome
  /** What happened, in a sentence or two of the scene's own narration ("You ..."). */
  summary: string
  /**
   * What the game wants the scene's writer to know about how it went, for a game played with a
   * girl: the moves, the turns of luck, whatever she might bring up. One line each. The reader is
   * not shown it; she reacts to it in the reply that follows the game. What goes in is the
   * game's own call.
   */
  account?: readonly string[]
}

/** A girl at the table. */
export interface Opponent {
  charId: string
  /** What the reader calls her. */
  name: string
  /** How well she plays, from 1 to 5. */
  skill: 1 | 2 | 3 | 4 | 5
  /** How she plays, in a few words; empty where nothing was judged. */
  style: string
}

export interface GamePlay {
  /** The girls playing against the reader; none for a game played alone. */
  opponents: readonly Opponent[]
  /** What is riding on the game, as the scene settled it; empty where nothing is. */
  stake: string
  /** How much she is to say for herself, as the player has it set; what that comes to is the game's. */
  chattiness: Chattiness
  /** How this game is to be played: every option the game declares, settled or at its default. */
  options: Readonly<Record<string, number>>
  /** The first move is made: from here, leaving the table is walking away from a game. */
  started: () => void
  /**
   * Says something in the scene's own dialogue box, in the game's words and at once: a move
   * made, a card turned. It goes onto the scene's transcript like any narration. The first one
   * is a first move: whatever of a reply was still unread is dropped.
   */
  narrate: (text: string) => void
  /**
   * Has a girl at the table say something: the model writes her one short line from `cue`, the
   * game's plain account of what just happened ("she called lower on a queen and an ace came").
   * Each is a call to the model and takes a moment, so a game keeps them for the moments worth
   * one. Resolves when her line is on the box, or when there will be none.
   */
  say: (charId: string, cue: string) => Promise<void>
  /**
   * Tells the framework how the game stands, in a sentence or two, whenever that changes. It is
   * what she is reminded of when she speaks, the reader's own remarks at the table included.
   */
  situation: (text: string) => void
  /**
   * The game is over. The component keeps showing how it ended for a beat; then the framework
   * clears the table and takes the result into the scene.
   */
  finish: (result: PlayResult) => void
}

export type GameComponent = ComponentType<{ play: GamePlay }>

const components = new Map<string, GameComponent>()

/** A game's component, registered once from its pack's own files, under the game's id. */
export function registerGame(gameId: string, component: GameComponent): void {
  components.set(gameId, component)
}

export function gameComponent(gameId: string): GameComponent | undefined {
  return components.get(gameId)
}
