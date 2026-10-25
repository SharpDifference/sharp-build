import type { Character } from './types'

/**
 * The character trait vocabulary: the closed set of switches the character-generation call may
 * assign, each one wired to a game mechanic somewhere.
 */

/** Every trait the LLM may assign, as it echoes them back and the file stores them. */
export const NATIVE_CHARACTER_TRAITS = [
  'Mood-swings',
  'Disagreeable',
  'Good-natured',
  'Materialist',
  'Terminally Online',
  'Promiscuous',
  'High Standards'
] as const

/** Editor-only traits are opt-in; ordinary AI character generation uses the native list. */
export const CHARACTER_TRAITS = [...NATIVE_CHARACTER_TRAITS, 'Godlike'] as const

export type CharacterTrait = (typeof CHARACTER_TRAITS)[number]

/** What each trait means, shown to the character-generation call so it can judge the fit. */
export const TRAIT_DESCRIPTIONS: Readonly<Record<CharacterTrait, string>> = {
  'Mood-swings':
    'affected by both positive and negative emotions more than normally',
  Disagreeable:
    'hard to get along with',
  'Good-natured':
    'easy to get along with',
  Materialist:
    'loves gifts and dislikes cheap presents',
  'Terminally Online':
    'addicted to social media or online content',
  Promiscuous:
    'hooks-up frequently and doesn\'t get jealous of her partners',
  'High Standards':
    'picky about who she\'s attracted to',
  'Godlike':
    'requires Godly Brain, Body and Heart before romance can begin (Godlike Standards mod)'
}

export function traitTone(trait: string): 'gold' | undefined {
  return trait === 'Godlike' ? 'gold' : undefined
}

/** Guard for a trait echoed back by the LLM. */
export function isCharacterTrait(value: unknown): value is CharacterTrait {
  return typeof value === 'string' && (CHARACTER_TRAITS as readonly string[]).includes(value)
}

/** Does this character carry the trait? The one place a trait is tested. */
export function hasTrait(
  character: Pick<Character, 'traits'> | undefined,
  trait: CharacterTrait
): boolean {
  return Boolean(character?.traits?.includes(trait))
}
