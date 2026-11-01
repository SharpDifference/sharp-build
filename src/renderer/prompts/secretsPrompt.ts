import type { GlobalTextId, TextEdits } from '@shared/presets/types'
import { blockText } from '@shared/presets/textBlocks'
import { withAdditions } from './promptBlocks'
import { appError } from '@shared/errors'
import { loveLifeBlurb } from '@shared/relationship'
import { SECRET_TIERS, secretText } from '@shared/secrets'
import {
  charKeyOf,
  fullNameOf,
  type Character,
  type CharSecret,
  type SecretTier,
  type StructuredRequest
} from '@shared/types'
import { keyedArray } from './profilePrompt'
import { objectSchema } from './schema'

/**
 * Builds and validates the one-shot secrets request a semester's Start sends; pure, no IO.
 */

/** One girl the call writes secrets for. */
export interface SecretsEntry {
  character: Character
  /** The tiers she is asked for, any of the three. */
  tiers: readonly SecretTier[]
  /** Every secret she already holds, told or untold, which the new ones must not repeat. */
  held: readonly string[]
  /** She has slept with the reader, which is all her love life's virgin line reads. */
  hadSex?: boolean
}

/** One girl's secrets as the model returns them, by tier. */
type SecretsDraftEntry = { key: string } & Partial<Record<SecretTier, unknown>>

/** The raw reply: one array per set of tiers asked, named as the prompt names it. */
export type SecretsReply = Record<string, unknown>

function invalid(detail: string): never {
  throw appError('SECRET_GEN_INVALID', "The generated students' secrets were not usable.", detail)
}

/** Who the secrets call is written by. */
const SECRETS_SYSTEM = [
  'You are a novelist inventing secrets for the students of a story set at a university.',
  'You return a single JSON object matching the provided schema exactly.'
].join(' ')

/** What a secret is, asked of every tier. */
const SECRET_LINES = [
  'A secret is something true of her that is not already in her description, backstory or love life, and that nobody would guess on first meeting her: either something she hides or something nobody would expect of her.',
  'It can be mundane, like "Sara is top 10 in the Angry Ducks mobile game.", or core to who she is, like "Sara almost died in a plane crash when she was 17 while flying to Paris."',
  'Make each one a concrete fact, something she does, has or did or something that happened to her, rather than a feeling on its own, and new rather than a detail of what her backstory already tells.',
  'Write each as one or two sentences in the third person that name her by her first name. It is already true before she meets the reader, and leaves him and the other students out of it.'
]

/** What each tier's secret is, matched to how close she is to the reader when she tells it. */
const TIER_LINES: Record<SecretTier, string> = {
  friendly:
    'friendly: what she tells the reader once they are friends. Something light that surprises, a hobby, habit or talent she is a little embarrassed by.',
  trusted:
    'trusted: what she tells him once she trusts him. Something more personal that she keeps from most people, that she is ashamed of, afraid of or hoping for.',
  devoted:
    'devoted: what she tells him once she is devoted to him. The deepest of her secrets, one she has told almost nobody because it shaped who she is or still hurts. It is more often something that happened to her than something she did.'
}

/** One girl's block: who she is, and the secrets she already has. */
function entryLines(entry: SecretsEntry): string[] {
  const { character } = entry
  const loveLife = loveLifeBlurb(character, { hadSex: entry.hadSex ?? false })
  return [
    `${charKeyOf(character.firstName, character.lastName)} — ${fullNameOf(character)}`,
    character.personality,
    ...(character.backstory.trim() ? [`Backstory: ${character.backstory.trim()}`] : []),
    ...(loveLife ? [`Love life: ${loveLife}`] : []),
    ...(character.likes.length > 0 ? [`Likes: ${character.likes.join(', ')}`] : []),
    ...(character.dislikes.length > 0 ? [`Dislikes: ${character.dislikes.join(', ')}`] : []),
    ...(entry.held.length > 0
      ? [`${character.firstName}'s secrets so far:`, ...entry.held.map((text) => `- ${text}`)]
      : []),
    ''
  ]
}

/** The girls asked for one set of tiers, and how the reply and the prompt name them. */
interface SecretsGroup {
  tiers: readonly SecretTier[]
  /** The reply's property for them. */
  property: string
  heading: string
  entries: SecretsEntry[]
}

/** The entries split by the tiers each is asked for, lowest tiers' sets first. */
function groupsOf(entries: readonly SecretsEntry[]): SecretsGroup[] {
  const groups = new Map<string, SecretsGroup>()
  for (const entry of entries) {
    const tiers = SECRET_TIERS.filter((tier) => entry.tiers.includes(tier))
    if (tiers.length === 0) continue
    const all = tiers.length === SECRET_TIERS.length
    const property = all ? 'characters' : tiers.join('_')
    const group = groups.get(property) ?? {
      tiers,
      property,
      heading: all ? 'STUDENTS' : `STUDENTS ASKED ONLY FOR ${tiers.join(' AND ')}`,
      entries: []
    }
    group.entries.push(entry)
    groups.set(property, group)
  }
  return [...groups.values()]
}

/** Builds the secrets request for every girl `entries` names, set in `setting`. */
export function buildSecretsPrompt(
  entries: readonly SecretsEntry[],
  setting: string,
  textEdits?: TextEdits<GlobalTextId>
): StructuredRequest {
  const preamble = [
    'FOR EACH STUDENT',
    blockText(textEdits, 'newgame.secrets.instructions', SECRET_LINES.join('\n')),
    blockText(textEdits, 'newgame.secrets.tiers', SECRET_TIERS.map((tier) => TIER_LINES[tier]).join('\n')),
    'Write only the tiers asked of the heading a student is listed under. Where her secrets so far are listed under her, every new one is unlike all of them.',
    '---',
    ''
  ].join('\n')

  const groups = groupsOf(entries)
  const tierFields = (tiers: readonly SecretTier[]): Record<string, unknown> =>
    Object.fromEntries(tiers.map((tier) => [tier, { type: 'string' }]))
  const schemaGroups = Object.fromEntries(
    groups.map((group) => [
      group.property,
      keyedArray(
        group.entries.map(({ character }) => charKeyOf(character.firstName, character.lastName)),
        tierFields(group.tiers)
      )
    ])
  )

  // Below the '---' divider: the students are all that varies, and the console log starts here.
  const answers = groups.map((group) => `${group.property} holds one entry per student under ${group.heading}`)
  const rest = [
    `${answers.join(', and ')}, each key exactly as written before her name, in the order listed.`,
    '',
    ...groups.flatMap((group) => [group.heading, ...group.entries.flatMap(entryLines)])
  ].join('\n')

  return {
    system: `${withAdditions(blockText(textEdits, 'newgame.secrets.system', SECRETS_SYSTEM), textEdits, 'newgame.secrets.additions')}\n\nSETTING\n${setting}`,
    user: `${preamble}\n${rest}`,
    schema: objectSchema('character_secrets', Object.keys(schemaGroups), schemaGroups),
    cacheKey: 'venus-university-secret-generation',
    logFrom: preamble.length + 1
  }
}

/** The records of one group keyed by charKey, an unknown or repeated key dropped. */
function foldSecrets(list: unknown, keys: ReadonlySet<string>): Record<string, SecretsDraftEntry> {
  const folded: Record<string, SecretsDraftEntry> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const named = (raw as { key?: unknown }).key
    const key = typeof named === 'string' ? named.trim() : ''
    if (!keys.has(key) || folded[key]) {
      console.warn(`[secrets] an entry named "${key}", unknown or repeated; skipping it.`)
      continue
    }
    folded[key] = raw as SecretsDraftEntry
  }
  return folded
}

/**
 * Validates a reply into each girl's new secrets, keyed by charKey, lowest tier first: a blank
 * tier is dropped, and a girl left with none refuses the reply.
 */
export function validateSecretDraft(
  reply: SecretsReply,
  entries: readonly SecretsEntry[]
): Record<string, CharSecret[]> {
  const keyOf = (character: Character): string => charKeyOf(character.firstName, character.lastName)
  const folded: Record<string, SecretsDraftEntry> = {}
  for (const group of groupsOf(entries)) {
    Object.assign(
      folded,
      foldSecrets(reply?.[group.property], new Set(group.entries.map(({ character }) => keyOf(character))))
    )
  }

  const secrets: Record<string, CharSecret[]> = {}
  for (const entry of entries) {
    const key = keyOf(entry.character)
    const raw = folded[key]
    const written: CharSecret[] = []
    for (const tier of SECRET_TIERS.filter((t) => entry.tiers.includes(t))) {
      const text = typeof raw?.[tier] === 'string' ? (raw[tier] as string).trim() : ''
      if (text === '') {
        console.warn(`[secrets] ${key} came back without a ${tier} secret; leaving it out.`)
        continue
      }
      written.push({ text: secretText(text), tier })
    }
    if (written.length === 0) invalid(`${fullNameOf(entry.character)} was left without a secret.`)
    secrets[key] = written
  }
  return secrets
}
