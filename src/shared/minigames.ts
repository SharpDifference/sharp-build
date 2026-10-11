/**
 * The mini-games this build carries, and where each may be played. A game is something the
 * reader plays inside a scene, alone or with the girls who are there. The framework
 * ({@link MINI_GAMES}) is one mod; each pack of games is a mod of its own that requires it.
 *
 * What is here is what a game *is* on paper: enough to list it, offer it and describe it to the
 * model. What it looks like and how it plays is the pack's own component, in the renderer.
 */

import type { ModDef } from './mods'

/** The framework's mod id. A pack names it in its `requires`. */
export const MINI_GAMES = 'mini-games'

/**
 * How much a girl says for herself during a game, the player's to choose. What each level comes
 * to is the game's own call; she always answers when the reader speaks to her.
 *
 * - `quiet`: she plays, and speaks when spoken to.
 * - `some`: a remark at the moments worth one.
 * - `lots`: she has something to say about most of what happens.
 */
export type Chattiness = 'quiet' | 'some' | 'lots'

/** The framework's options that set it: one of the three is on. */
export const CHAT_OPTIONS: Readonly<Record<Chattiness, string>> = {
  quiet: 'talk-quiet',
  some: 'talk-some',
  lots: 'talk-lots'
}

/** The framework's option that has every game suggested often, wherever it can be played. */
export const SUGGEST_OFTEN = 'suggest-often'

/**
 * How much of the stage a game is drawn on. The scene stays lit behind every one of them.
 *
 * - `table`: a compact board in the upper middle, the girls either side of it.
 * - `board`: most of the stage above the dialogue box.
 * - `screen`: the whole stage, for a game that is all action.
 */
export type PlaySurface = 'table' | 'board' | 'screen'

/**
 * One thing about how a game is played that the two of them may settle between them before it
 * starts: a whole number in a range. The model sets it from what was said when she agrees; the
 * game is handed the value and is the one that knows what it means.
 */
export interface GameOption {
  /** Stable, lower case: the key the game reads its value by. */
  id: string
  /** What it sets, for the model, in a clause ("how many calls each player makes"). */
  describe: string
  /** What it is called on the game's page, in a few words for the player; `describe` where absent. */
  label?: string
  min: number
  max: number
  /** What it is where nothing was said, and for a game played alone. */
  default: number
}

/**
 * How readily a girl brings a game up herself. It never limits the reader, who may ask for any
 * game on offer at any time.
 *
 * - `often`: it is what people come to this place for.
 * - `sometimes`: when the moment is slow or playful.
 * - `rarely`: only when the moment really calls for it.
 * - `never`: she does not bring it up herself.
 */
export type SuggestRate = 'often' | 'sometimes' | 'rarely' | 'never'

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
  /**
   * How a game of it goes, in a sentence, as the table actually runs it: what the model is told
   * she can agree to, and nothing else.
   */
  format: string
  /** What may be varied by agreement; absent, the game is always played the one way. */
  options?: readonly GameOption[]
  /** How readily a girl suggests it herself; `sometimes` where it does not say. */
  suggest?: SuggestRate
  /** The same, at particular places, by location id: an arcade game at the arcade is `often`. */
  suggestAt?: Readonly<Record<string, SuggestRate>>
  /** The surface it is played on; a `table` where it does not say. */
  surface?: PlaySurface
  /** Played on the keyboard, so the line to her does not take the focus when the game opens. */
  keys?: boolean
  /** How it is played, for the player: the keys or the pointer, in a sentence. Shown on its page. */
  controls?: string
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

/**
 * A pack's entry on the Mods screen: one mod for all of its games, needing the framework, with
 * a switch for each game among its options so a player keeps the ones he wants.
 */
export function packMod(pack: {
  id: string
  name: string
  author: string
  version: string
  blurb: string
  games: readonly MiniGameDef[]
}): ModDef {
  return {
    id: pack.id,
    name: pack.name,
    author: pack.author,
    version: pack.version,
    scope: 'anytime',
    defaultOn: true,
    blurb: pack.blurb,
    offNote: 'A game already played stays in the story and in her memories.',
    requires: [MINI_GAMES],
    options: pack.games.map((game) => ({
      id: game.id,
      label: `${game.icon} ${game.name}`,
      hint: `${game.blurb.charAt(0).toUpperCase()}${game.blurb.slice(1).replace(/\.$/, '')}.`,
      default: true
    }))
  }
}

/**
 * Whether a game's own switch is on: its option in the mod that brings it, where that mod gives
 * it one. A pack that declares no switch for a game has it on whenever the pack is.
 */
export function gameSwitchOn(
  game: MiniGameDef,
  mod: ModDef | undefined,
  optionSet: (optionId: string) => boolean | undefined
): boolean {
  const option = mod?.options?.find((entry) => entry.id === game.id)
  return option ? (optionSet(game.id) ?? option.default) : true
}

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
  isOn: (modId: string, game: MiniGameDef) => boolean,
  games: readonly MiniGameDef[] = MINI_GAMES_LIST
): MiniGameDef[] {
  return games.filter(
    (game) =>
      isOn(game.modId, game) &&
      (!game.locations || (spot.location !== null && game.locations.includes(spot.location))) &&
      spot.girls >= game.players.min
  )
}

/**
 * How readily a girl suggests a game in the scene at hand: the place's own rate where the game
 * names one, the game's otherwise, unless the player has every game come up often. `busy` is a scene with something else going on, a class or a
 * shift, where nobody suggests a game whatever it is.
 */
export function suggestRate(
  game: MiniGameDef,
  location: string | null,
  busy: boolean,
  /** The player has asked for games to come up often: every game does, where one may at all. */
  keen = false
): SuggestRate {
  if (busy) return 'never'
  if (keen) return 'often'
  return (location && game.suggestAt?.[location]) || game.suggest || 'sometimes'
}

/** What a player has set for one game on its page: his own usual options, and how often it comes up. */
export interface GamePrefs {
  /** The value he would rather an option started at, by option id. */
  options?: Readonly<Record<string, number>>
  /** How readily a girl suggests it, everywhere it is played, in place of what the game says. */
  suggest?: SuggestRate
}

/**
 * A game as a player has tuned it: each option starting where he set it, where that is a value
 * the game allows, and suggested as often as he chose. The game itself where he has set nothing.
 */
export function tuned(game: MiniGameDef, prefs: GamePrefs | undefined): MiniGameDef {
  if (!prefs) return game
  const options = game.options?.map((option) => {
    const value = prefs.options?.[option.id]
    const fits =
      value !== undefined && Number.isInteger(value) && value >= option.min && value <= option.max
    return fits ? { ...option, default: value } : option
  })
  return {
    ...game,
    ...(options ? { options } : {}),
    ...(prefs.suggest ? { suggest: prefs.suggest, suggestAt: undefined } : {})
  }
}

/** Who a game is played with, as a page says it. */
export function playersWords(game: MiniGameDef): string {
  const { min, max } = game.players
  if (max <= 0) return 'alone'
  const girls = max === 1 ? 'one girl' : min >= max ? `${max} girls` : `up to ${max} girls`
  return min === 0 ? `alone, or with ${girls}` : `with ${girls}`
}

/** A game's options at their defaults. */
export function defaultOptions(game: MiniGameDef): Record<string, number> {
  return Object.fromEntries((game.options ?? []).map((option) => [option.id, option.default]))
}

/**
 * What was settled for a game, made safe to play: every option the game declares, each a whole
 * number inside its range, the default wherever what came back is missing or is not one.
 */
export function settledOptions(game: MiniGameDef, given: unknown): Record<string, number> {
  const source = given && typeof given === 'object' ? (given as Record<string, unknown>) : {}
  return Object.fromEntries(
    (game.options ?? []).map((option) => {
      const value = Number(source[option.id])
      const whole = Number.isInteger(value) && value >= option.min && value <= option.max
      return [option.id, whole ? value : option.default]
    })
  )
}

/** Names in a row, as a sentence has them: "Ana", "Ana and Bea", "Ana, Bea and Cy". */
export function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The fewest girls a game with anyone in it is played with. */
export function fewestWith(game: MiniGameDef): number {
  return Math.max(1, game.players.min)
}

/**
 * The tables of more than one girl a game could be asked for among the girls here: everyone, or
 * where the game seats fewer than are here, each way of filling its seats. None for a game one
 * girl plays, or with too few here.
 */
export function groupsFor(game: MiniGameDef, girls: readonly string[]): string[][] {
  const size = seatsFor(game, girls.length)
  if (size < 2 || size < game.players.min) return []
  const pick = (from: readonly string[], n: number): string[][] =>
    n === 0
      ? [[]]
      : from.flatMap((girl, i) => pick(from.slice(i + 1), n - 1).map((rest) => [girl, ...rest]))
  return pick(girls, size)
}

/** How many of the girls here a game seats: all of them, up to its `max`. */
export function seatsFor(game: MiniGameDef, girls: number): number {
  return Math.min(girls, game.players.max)
}
