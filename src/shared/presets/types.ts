/**
 * Prompt Studio presets: the shapes of an imported or native preset, the game's own coarse prompt
 * parts it arranges, and the ids of the text blocks a preset or the settings may rewrite.
 */

/** The Prompt Studio mod's id. */
export const PROMPT_STUDIO_MOD = 'prompt-studio'

/** The game's coarse prompt parts a preset may reorder or disable, in the order a scene call builds them. */
export const GAME_MARKERS = [
  'persona',
  'jsonRules',
  'setting',
  'reader',
  'cast',
  'now',
  'class',
  'lorebook',
  'modLines',
  'storyRecall',
  'storySoFar',
  'sceneSoFar',
  'yourTurn'
] as const
export type GameMarker = (typeof GAME_MARKERS)[number]

/** Parts a preset can neither disable nor move out of `system`: the reply contract. */
export const PROTECTED_MARKERS: readonly GameMarker[] = ['jsonRules']

/** One game part as a scene builder emits it, its text already carrying any edits. */
export interface GamePart {
  id: GameMarker
  role: 'system' | 'user'
  text: string
}

/** The scene calls a preset is applied to. */
export type SceneSpot = 'opening' | 'continue' | 'closing' | 'solo'

/** The text blocks a preset owns: the cast scene's persona and its instructions. */
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

/** The text blocks the studio owns outside any preset: the personas, then the New Game calls' prose. */
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

export type PresetSource = 'sillytavern' | 'marinara' | 'native'

/** One row of a preset: either a game part (`marker` set, `content` unused) or text of the preset's own. */
export interface PresetBlock {
  id: string
  name: string
  role: 'system' | 'user' | 'assistant'
  enabled: boolean
  /** `ordered` sits where the row stands; `depth` sits that many parts back from the end of `user`. */
  position: 'ordered' | 'depth'
  depth: number
  /** Wraps the content in `<tag>…</tag>` when set. */
  wrapXml?: string
  marker?: GameMarker
  content: string
  /** Why the importer turned this block off, shown beside it. */
  conflict?: string
}

/** A SillyTavern regex script, kept for reference and never run while disabled. */
export interface RegexScript {
  name: string
  find: string
  replace: string
  enabled: boolean
}

/** The samplers a preset may set for scene calls on a custom endpoint. */
export interface PresetSampling {
  temperature?: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
}

export interface Preset {
  id: string
  name: string
  source: PresetSource
  blocks: PresetBlock[]
  overrides?: TextEdits<SceneTextId>
  /** Drops the game's `persona` part in favour of the block named by `mainBlockId`. */
  mainReplacesPersona?: boolean
  mainBlockId?: string
  sampling?: PresetSampling
  regex?: RegexScript[]
  notes?: string
}

/** Which scene call a builder made and who is in it, as the builder knows it; stamped on the request and read by `streamScene`. */
export interface SceneSpotTag {
  spot: SceneSpot
  /** The cast's given names in order; empty for a solo scene. */
  cast: string[]
}

/** The names a preset's `{{user}}`, `{{char}}` and `{{group}}` macros fill in. */
export interface PresetNames {
  user: string
  /** The first cast girl's given name, or empty with nobody cast. */
  char: string
  /** Every cast girl's given name, joined with ", ". */
  group: string
}

/** What a scene request carries for main to apply the active preset with. */
export interface PresetRequest {
  spot: SceneSpot
  playthroughId: string
  /** The save's variables as they stood before this call. */
  vars: Record<string, string>
  names: PresetNames
}

/** One preset as the list shows it. */
export interface PresetSummary {
  id: string
  name: string
  source: PresetSource
}

/** Every stored preset's summary, and which one is in force. */
export interface PresetListing {
  active: string
  presets: PresetSummary[]
}

/** A preset read from a file, not yet kept, and what the import left behind. */
export interface PresetImport {
  preset: Preset
  warnings: string[]
}

/** One variable change the model asks for in a scene reply's `vars`. */
export interface VarOp {
  name: string
  op: 'set' | 'add' | 'append'
  value: string
}
