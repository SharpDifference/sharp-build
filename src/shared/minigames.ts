/**
 * The mini-games this build carries, and where each may be played. A game is something the
 * reader plays inside a scene, alone or with the girls who are there. The framework
 * ({@link MINI_GAMES}) is one mod; each pack of games is a mod of its own that requires it.
 *
 * What is here is what a game *is* on paper: enough to list it, offer it and describe it to the
 * model. What it looks like and how it plays is the pack's own component, in the renderer.
 */

/** The framework's mod id. A pack names it in its `requires`. */
export const MINI_GAMES = 'mini-games'

/**
 * How much of the stage a game is drawn on. The scene stays lit behind every one of them.
 *
 * - `table`: a compact board in the upper middle, the girls either side of it.
 * - `board`: most of the stage above the dialogue box.
 * - `screen`: the whole stage, for a game that is all action.
 */
export type PlaySurface = 'table' | 'board' | 'screen'

export interface MiniGameDef {
  /** Stable, lower case with dashes: memories and saves may name it. */
  id: string
  /** The mod that brings this game; the game is offered only while that mod is on. */
  modId: string
  name: string
  /** One glyph, as a location's is. */
  icon: string
  /** What the game is, in a line: the list's own words, and what the model is told. */
  blurb: string
  /** The location ids it is played at; absent, anywhere. */
  locations?: readonly string[]
  /**
   * How many girls play against the reader: `min` 0 for a game he can play alone, `max` 0 for
   * one nobody joins.
   */
  players: { min: number; max: number }
  /** The surface it is played on; a `table` where it does not say. */
  surface?: PlaySurface
  /** What makes someone good at it, in a sentence, for judging how well a girl plays. */
  skillBrief: string
}

/**
 * Each game's entry, found rather than listed: every file in `src/shared/minigameEntries/`,
 * named for the game's id, whose default export is its {@link MiniGameDef}.
 */
const ENTRIES = import.meta.glob<MiniGameDef>('./minigameEntries/*.ts', {
  eager: true,
  import: 'default'
})

/** Every game in this build, by id. */
export const MINI_GAMES_LIST: readonly MiniGameDef[] = Object.keys(ENTRIES)
  .sort()
  .map((file) => ENTRIES[file])

/** Where a scene stands, as far as a game cares. */
export interface PlaySpot {
  /** The scene's location id, or null where it has none the game knows. */
  location: string | null
  /** How many girls are in the scene. */
  girls: number
}

/**
 * The games on offer in a scene: their mod is on, the place is one of theirs, and enough girls
 * are here to play. A game with a `min` of 0 is offered with anyone or no one around.
 */
export function gamesOffered(
  spot: PlaySpot,
  isOn: (modId: string) => boolean,
  games: readonly MiniGameDef[] = MINI_GAMES_LIST
): MiniGameDef[] {
  return games.filter(
    (game) =>
      isOn(game.modId) &&
      (!game.locations || (spot.location !== null && game.locations.includes(spot.location))) &&
      spot.girls >= game.players.min
  )
}

/** How many of the girls here a game seats: all of them, up to its `max`. */
export function seatsFor(game: MiniGameDef, girls: number): number {
  return Math.min(girls, game.players.max)
}
