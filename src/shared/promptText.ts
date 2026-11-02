/**
 * The game's rewritable prompt text and the parts a scene call is built from: the ids of the text
 * blocks a mod may rewrite, the edits the builders are handed, the class call's pool sizes, and
 * the coarse parts a scene builder emits beside its two strings.
 */

/** The cast scene's persona and its instruction blocks. */
export const SCENE_TEXT_IDS = [
  'persona.scene',
  'scene.opening',
  'scene.continue',
  'scene.continue.first-line',
  'scene.continue.going',
  'scene.continue.ending',
  'scene.closing',
  'scene.solo'
] as const
export type SceneTextId = (typeof SCENE_TEXT_IDS)[number]

/** Every other call's rewritable text: the personas, then the New Game calls' prose. */
export const GLOBAL_TEXT_IDS = [
  'persona.solo',
  'persona.texting',
  'persona.narration',
  'persona.designer',
  'newgame.classes.system',
  'newgame.classes.additions',
  'newgame.classes.instructions',
  'newgame.profiles.system',
  'newgame.profiles.additions',
  'newgame.profiles.instructions',
  'newgame.profiles.housing',
  'newgame.profiles.freeTime',
  'newgame.profiles.handle',
  'newgame.profiles.springBreak',
  'newgame.profiles.next.newcomers',
  'newgame.profiles.next.housing',
  'newgame.profiles.next.graduates',
  'newgame.occasions.system',
  'newgame.occasions.additions',
  'newgame.occasions.instructions',
  'newgame.occasions.fillers',
  'newgame.occasions.gala',
  'newgame.occasions.dance',
  'newgame.occasions.careerFair',
  'newgame.occasions.concert',
  'newgame.secrets.system',
  'newgame.secrets.additions',
  'newgame.secrets.instructions',
  'newgame.secrets.tiers'
] as const
export type GlobalTextId = (typeof GLOBAL_TEXT_IDS)[number]

export type TextBlockId = SceneTextId | GlobalTextId

/** Edits to text blocks, by id; an absent id sends the shipped text. */
export type TextEdits<Id extends string = TextBlockId> = Partial<Record<Id, string>>

/** The edits the builders are handed: the cast scene's own, and every other call's. */
export interface TextEditSet {
  scene?: TextEdits<SceneTextId>
  global?: TextEdits<GlobalTextId>
}

/** The edited text for a block where a non-blank string is stored for it, else the fallback. */
export function blockText<Id extends TextBlockId>(
  edits: TextEdits<TextBlockId> | undefined,
  id: Id,
  fallback: string
): string {
  const edit: unknown = edits?.[id]
  return typeof edit === 'string' && edit.trim() !== '' ? edit : fallback
}

/** The class call's shipped pool sizes. */
export const DEFAULT_CLASS_CATALOG = { pe: 10, filler: 5, perMajor: 4 } as const

/** The range each class pool size is kept to, both ends included. */
export const CLASS_CATALOG_RANGES = {
  pe: { min: 1, max: 20 },
  filler: { min: 0, max: 15 },
  perMajor: { min: 1, max: 8 }
} as const

export type ClassCatalogKey = keyof typeof CLASS_CATALOG_RANGES

/** Pool sizes for the class call; an absent one is its shipped size. */
export type ClassCatalogEdits = Partial<Record<ClassCatalogKey, number>>

/** The parts a scene builder emits, in the order it builds them. */
export const PROMPT_PARTS = [
  'persona',
  'jsonRules',
  'setting',
  'reader',
  'cast',
  'now',
  'class',
  'lorebook',
  'modLines',
  'storySoFar',
  'sceneSoFar',
  'yourTurn'
] as const
export type PromptPartId = (typeof PROMPT_PARTS)[number]

/**
 * One part of a scene request as its builder emitted it, its text already carrying any edits and
 * found verbatim in the request's `system` or `user`. Parts a mod adds in main carry its own ids.
 */
export interface PromptPart {
  id: string
  role: 'system' | 'user'
  text: string
}

/** The scene calls a builder makes. */
export type SceneSpot = 'opening' | 'continue' | 'closing' | 'solo'

/** Which scene call a builder made and who is in it. */
export interface SceneSpotTag {
  spot: SceneSpot
  /** The cast's given names in order; empty for a solo scene. */
  cast: string[]
}
