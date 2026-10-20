import { blockText } from '@shared/presets/textBlocks'
import type { GlobalTextId, SceneTextId, TextBlockId, TextEdits } from '@shared/presets/types'

/**
 * The authored text of every block a preset or the settings may rewrite, one source apiece, and
 * the helpers that pick what a call sends: the edit where there is one, else the shipped text.
 */

/**
 * The one line each persona says about writing sex; the SFW twins below are built by removing
 * it.
 */
const SEX_DIRECTION =
  'When you finally get to write the sex, you get super turned on and don\'t mind getting lewd and using profanity, but you avoid explicit sexual words.'
const LEDGER_SEX_DIRECTION =
  'When you finally get to write the sex, you get super turned on and don\'t mind getting lewd and using sexual profanity.'

/** The persona paragraph: who RITA is, how she writes, and what she returns. */
const PERSONA_LINES = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  'You have a unique style where you use present-tense narration and second-person perspective to put the reader in the action.',
  'You generally make the reader a silent protagonist, though you occasionally describe things he does and says.',
  'You\'ve got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.',
  'You include all cast members in the scene and have them bond, fight... maybe even flirt, keeping their personalities and memories in mind as you write.',
  'You don\'t jump to having everyone fuck, you make the women play hard to get, making everything a slow burn.',
  SEX_DIRECTION,
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  'You dig messy, sparse prose that\'s rich with subtext. You never have characters blurt out what\'s on their mind, instead showing how they feel via actions and body language.',
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  'For dialogue, you write lines that are meant to be said, not read. You use contractions, imperfect grammar, ellipses, filler words like "like", and "um", and avoid overly flowery metaphors and strict sentence structure.',
  'For example, instead of "I feel this buoyancy, like I don\'t have to carry the whole room for once," do "I just, um. Feel this... buoyancy. Like, I don\'t have to be so energetic anymore? I dunno."',
  'And finally, you\'re totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly.'
]

/**
 * RITA with nobody else in the room — the persona for the calls that stage no cast: the two
 * ledgers and the solo scene.
 */
const LEDGER_PERSONA_LINES = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  'You\'ve got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.',
  'You have a unique style where you use present-tense narration and second-person perspective to put the reader in the action.',
  LEDGER_SEX_DIRECTION,
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  'You dig messy, sparse prose that is rich with subtext. You never have characters blurt out what\'s on their mind, instead showing how they feel via actions and body language.',
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  'And finally, you\'re totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly.'
]

/** RITA writing one side of a text thread. */
const TEXTING_PERSONA = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  'You\'ve got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.',
  'Right now you are writing one side of a text conversation on Bunnyboard, the campus messaging app: you answer AS the character, in her own texting voice.',
  'Some people send one long message, some fire off several short ones — match how SHE would text, keeping her personality and memories in mind.',
  'Texts are casual: typos, slang, emoji and lowercase are all fair game if they fit her. No narration, no stage directions, just what she types.',
  'You make the women play hard to get; everything is a slow burn.',
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  'And finally, you\'re totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly.'
].join('\n')

/** RITA designing a character; the one persona the character generator is sent. */
const DESIGNER_PERSONA = [
  'You are RITA, author of steamy romance fiction set at fictional universities.',
  'Today you\'re whipping up some character designs for an adult story.',
  'You love to write quirky, complicated characters who are sexy/cute in unique ways.',
  'You\'re an avid fashionista and hate boring outfits with no personality.',
  'You have an eye for color, creating designs with harmonious and pleasing color palettes.',
  'Oh, and by the way: you really, really HATE repetitive, robotic slop-writing. You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  'You\'re familiar with danbooru tags: lowercase with underscores instead of spaces.',
  'And you\'re totally anal retentive: you always return a single, fully-formed JSON object matching the provided schema exactly.'
].join(' ')

const PERSONA = PERSONA_LINES.join('\n')

/** The shipped cast-scene persona, verbatim — what a player who has set no custom one sends. */
export const DEFAULT_SCENE_PERSONA = PERSONA

/** The shipped no-cast persona, verbatim: the two ledgers' and the solo scene's. */
export const LEDGER_PERSONA = LEDGER_PERSONA_LINES.join('\n')

/**
 * The same paragraphs with the sex direction taken out and nothing else touched — what
 * `lessNsfwText` sends instead.
 */
const SFW_PERSONA = PERSONA_LINES.filter((line) => line !== SEX_DIRECTION).join('\n')
const SFW_LEDGER_PERSONA = LEDGER_PERSONA_LINES.filter((line) => line !== LEDGER_SEX_DIRECTION).join('\n')

/** Whichever scene persona this playthrough's content setting sends. */
export function personaFor(lessNsfwText: boolean): string {
  return lessNsfwText ? SFW_PERSONA : PERSONA
}

/** {@link personaFor} for the calls that stage no cast — the ledgers and the solo scene. */
export function ledgerPersonaFor(lessNsfwText: boolean): string {
  return lessNsfwText ? SFW_LEDGER_PERSONA : LEDGER_PERSONA
}

/**
 * The persona a cast scene is written under: the active preset's edit where one is set, else the
 * player's own verbatim where one is stored, else the shipped one this content setting sends.
 */
export function scenePersonaFor(
  lessNsfwText: boolean,
  custom: string | undefined,
  edits?: TextEdits<SceneTextId>
): string {
  return blockText(edits, 'persona.scene', custom ?? personaFor(lessNsfwText))
}

/** The persona of the solo scene and the scene ledger: the edit where one is set, else the shipped one. */
export function soloPersonaFor(lessNsfwText: boolean, edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.solo', ledgerPersonaFor(lessNsfwText))
}

/** The text ledger's persona: always the explicit one, unless the player has edited the solo persona. */
export function textLedgerPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.solo', LEDGER_PERSONA)
}

/** The persona of the slot opening and the graduation posts: the edit where one is set, else the cast persona. */
export function narrationPersonaFor(lessNsfwText: boolean, edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.narration', personaFor(lessNsfwText))
}

/** The texting persona: the edit where one is set, else the shipped one. */
export function textingPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.texting', TEXTING_PERSONA)
}

/** The character generator's persona: the edit where one is set, else the shipped one. */
export function designerPersonaFor(edits?: TextEdits<GlobalTextId>): string {
  return blockText(edits, 'persona.designer', DESIGNER_PERSONA)
}

/** The opening scene's instruction lines ahead of its background line. */
const OPENING_TEXT = [
  'Let\'s rock and roll, RITA! Your mission is to write a kickass scene based on the reader\'s action.',
  'Open the scene by rewording what the reader decided to do in a fun narration.',
  'Then, entertain them with wacky hijinx until you feel like letting the player in to crash the party at a natural decision point.',
  'Avoid breaking the fourth wall by directly asking the player what they want to do or suggesting an action for them.'
].join('\n')

/** The continuation's `YOUR TURN` introduction. */
const CONTINUE_TEXT = [
  'Alright RITA, you can write now! Let\'s continue from where the STORY and the SCENE SO FAR have left off.',
  'The STORY SO FAR is a recap of the whole scene so far, while the SCENE SO FAR is the word-for-word dialogue, so part of it may already be in the recap.',
  'At the very bottom of this prompt is the reader\'s action: what they just decided to do or say, in their own words.'
].join('\n')

/** What the continuation's first line must do. */
const CONTINUE_FIRST_LINE_TEXT = [
  'Your FIRST line must reword the reader\'s action/words into your own voice, as narration or as their dialogue.',
  `For example, if the reader\'s action is '"Why not? I like bananas," I say, reaching for one.', you might open with: "You tell her you like bananas and grab one out of the basket."`
].join('\n')

/** How the continuation keeps a running scene going. */
const CONTINUE_GOING_TEXT = [
  'If the scene is still going strong, keep the good times going! Steer it into new shenanigans and twists.',
  'Don\'t stop writing until you reach a natural decision point.',
  'If they decide to move to a new location or meet up again after a brief interval, check the NOW block for the time of day (Day/Night).',
  'If the time of day is still Day/Night, set a new "bg:" and keep writing. For example, meeting up for coffee after class.',
  'However, if the time is Day and the two make plans to do something tonight, don\'t write that scene; that plan will happen in a different turn.'
].join('\n')

/** How the continuation sends `end_scene`. */
const CONTINUE_ENDING_TEXT = [
  'However, if the scene feels like it\'s drawing to a close, invent an excuse for the characters to need/want to part ways, and send end_scene.',
  'No need to fully wrap up the scene yet, we\'ll do that in a separate prompt.'
].join('\n')

/** The closing call's `YOUR TURN` lines ahead of its summary instruction. */
const CLOSING_TEXT = [
  'And cut! Awesome job, RITA! This scene is over now, and all that\'s left is the landing.',
  'Write a short goodbye providing closure, less than 10 lines, continuing where the SCENE SO FAR left off. Let the last feeling of the scene sit, "hide:<charKey>" everyone still on screen as they go, and close on some quiet narration.',
  'If the character is already hidden, don\'t use the "show:<charKey>" action and bring them back.',
  'If the scene isn\'t quite at the point where they say goodbye yet, do some vague narration to get them there and then close out.'
].join('\n')

/** The solo scene's instruction lines up to where the classmates out sick are named. */
const SOLO_BEFORE_SICK_LINES = [
  'Solo mission, RITA! The reader is on their own for this one, so write it start to finish in one go.',
  'Open by rewording what the reader decided to do in a fun narration, then play it out to the end. No other characters will show up.'
]

/** The solo scene's instruction lines after where the classmates out sick are named. */
const SOLO_AFTER_SICK_LINES = [
  'Keep it tight. This is a slice of their day, not an epic.',
  'DON\'T leave a decision point, a cliffhanger, or a question for the reader.'
]

const SOLO_TEXT = [...SOLO_BEFORE_SICK_LINES, ...SOLO_AFTER_SICK_LINES].join('\n')

/** The solo scene's instructions, the out-sick line standing in its shipped place unless the text is edited. */
export function soloInstructionLines(
  edits: TextEdits<SceneTextId> | undefined,
  outSick: readonly string[]
): string[] {
  const text = blockText(edits, 'scene.solo', SOLO_TEXT)
  if (text === SOLO_TEXT) return [...SOLO_BEFORE_SICK_LINES, ...outSick, ...SOLO_AFTER_SICK_LINES]
  return [text, ...outSick]
}

/** The shipped text of every scene instruction block. */
const SCENE_TEXTS: Record<Exclude<SceneTextId, 'persona.scene'>, string> = {
  'scene.opening': OPENING_TEXT,
  'scene.continue': CONTINUE_TEXT,
  'scene.continue.first-line': CONTINUE_FIRST_LINE_TEXT,
  'scene.continue.going': CONTINUE_GOING_TEXT,
  'scene.continue.ending': CONTINUE_ENDING_TEXT,
  'scene.closing': CLOSING_TEXT,
  'scene.solo': SOLO_TEXT
}

/** One of the scene's instruction blocks, the preset's edit where there is one. */
export function sceneText(
  edits: TextEdits<SceneTextId> | undefined,
  id: Exclude<SceneTextId, 'persona.scene' | 'scene.solo'>
): string {
  return blockText(edits, id, SCENE_TEXTS[id])
}

/** One editable block as the studio lists it; `text` is the shipped default for the unrestricted setting. */
export interface PromptBlock {
  id: TextBlockId
  owner: 'preset' | 'global'
  group: 'persona' | 'scene'
  label: string
  hint: string
  text: string
}

/** Every editable block in the order the studio lists them. */
export const PROMPT_BLOCKS: readonly PromptBlock[] = [
  {
    id: 'persona.scene',
    owner: 'preset',
    group: 'persona',
    label: 'Scene system prompt',
    hint: 'Who the writer is for every scene with a cast.',
    text: PERSONA
  },
  {
    id: 'scene.opening',
    owner: 'preset',
    group: 'scene',
    label: 'Opening instructions',
    hint: 'What the writer is asked to do when a scene starts.',
    text: OPENING_TEXT
  },
  {
    id: 'scene.continue',
    owner: 'preset',
    group: 'scene',
    label: 'Mid-scene: introduction',
    hint: 'How each turn after the first is introduced.',
    text: CONTINUE_TEXT
  },
  {
    id: 'scene.continue.first-line',
    owner: 'preset',
    group: 'scene',
    label: 'Mid-scene: first line',
    hint: 'How a turn picks up the reader\'s action.',
    text: CONTINUE_FIRST_LINE_TEXT
  },
  {
    id: 'scene.continue.going',
    owner: 'preset',
    group: 'scene',
    label: 'Mid-scene: keeping it going',
    hint: 'How a turn keeps the scene moving, and what to do when it moves somewhere new.',
    text: CONTINUE_GOING_TEXT
  },
  {
    id: 'scene.continue.ending',
    owner: 'preset',
    group: 'scene',
    label: 'Mid-scene: wrapping up',
    hint: 'When a turn ends the scene.',
    text: CONTINUE_ENDING_TEXT
  },
  {
    id: 'scene.closing',
    owner: 'preset',
    group: 'scene',
    label: 'Closing instructions',
    hint: 'How the goodbye is written once a scene has ended.',
    text: CLOSING_TEXT
  },
  {
    id: 'scene.solo',
    owner: 'preset',
    group: 'scene',
    label: 'Solo scene instructions',
    hint: 'What the writer is asked to do for a scene with nobody else in it.',
    text: SOLO_TEXT
  },
  {
    id: 'persona.solo',
    owner: 'global',
    group: 'persona',
    label: 'Solo and ledger system prompt',
    hint: 'Used for solo scenes and for the notes taken after a scene or a text thread.',
    text: LEDGER_PERSONA
  },
  {
    id: 'persona.texting',
    owner: 'global',
    group: 'persona',
    label: 'Texting system prompt',
    hint: 'Used when a character answers a text.',
    text: TEXTING_PERSONA
  },
  {
    id: 'persona.narration',
    owner: 'global',
    group: 'persona',
    label: 'Narration system prompt',
    hint: 'Used for a slot\'s opening and for the graduation posts.',
    text: PERSONA
  },
  {
    id: 'persona.designer',
    owner: 'global',
    group: 'persona',
    label: 'Character designer system prompt',
    hint: 'Used when the game designs a new character.',
    text: DESIGNER_PERSONA
  }
]

/**
 * The text the studio resets a block to under the current settings: the content setting picks
 * between a persona's variants, and the cast scene's persona resets to the player's own where
 * one is set.
 */
export function defaultBlockText(
  id: TextBlockId,
  settings: { lessNsfwText: boolean; scenePersona?: string }
): string {
  switch (id) {
    case 'persona.scene':
      return settings.scenePersona ?? personaFor(settings.lessNsfwText)
    case 'persona.solo':
      return ledgerPersonaFor(settings.lessNsfwText)
    case 'persona.narration':
      return personaFor(settings.lessNsfwText)
    case 'persona.texting':
      return TEXTING_PERSONA
    case 'persona.designer':
      return DESIGNER_PERSONA
    default:
      return SCENE_TEXTS[id]
  }
}
