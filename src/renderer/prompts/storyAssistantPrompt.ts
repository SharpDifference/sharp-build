import { ASSISTANT_ACTION_LIMIT } from '@shared/storyAssistant'
import type { CharFlags, StructuredRequest } from '@shared/types'
import { objectSchema } from './schema'

/** One girl in the scene, as much of her as the player has been shown. */
export interface AssistantGirl {
  /** Her first name, or null while the reader has not learned it. */
  name: string | null
  /** Her first and last name as the story's own text spells them, for masking an unnamed one. */
  names: readonly string[]
  /** The tag her contact page wears. */
  tag: string
  flags: Pick<
    CharFlags,
    | 'isLover'
    | 'hasKissed'
    | 'hadSex'
    | 'brokenUp'
    | 'harem'
    | 'friendZoned'
    | 'friendZonedBy'
    | 'gaveContactInfo'
    | 'blocked'
  >
  /** Every line her contact page has open — likes, her type, backstory, love life — ready to print. */
  profile: readonly string[]
  /** Her memories, told secrets, the player's notes and the plans ahead, ready to print. */
  record: readonly string[]
}

/** Everything one read of the scene is built from. */
export interface AssistantContext {
  setting: string
  reader: string
  /** The date and half of the day the scene is in. */
  when: string
  /** Earlier slots' summaries, dated, oldest first. */
  earlier: readonly string[]
  girls: readonly AssistantGirl[]
  /** The running summary, covering the scene up to where `lines` takes over. */
  summary: string | null
  /** The scene's tail, a line of the transcript to each. */
  lines: readonly string[]
  /** What the player asked; blank for a read of the scene as a whole. */
  question: string
  lessNsfwText: boolean
}

/** What the assistant calls the n-th girl in the scene whose name the reader has not learned. */
function unnamedLabel(index: number, count: number): string {
  return count === 1 ? 'UNNAMED GIRL' : `UNNAMED GIRL ${index + 1}`
}

/** `word` wherever no letter, number or underscore of any script touches either end of it. */
export function wholeWord(word: string, flags = 'u'): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, flags)
}

/** `text` with each of `name`'s whole-word appearances, as written or in capitals, swapped for `label`. */
function maskName(text: string, name: string, label: string): string {
  const trimmed = name.trim()
  if (!trimmed) return text
  let out = text
  for (const spelling of new Set([trimmed, trimmed.toUpperCase()])) {
    out = out.replace(wholeWord(spelling, 'gu'), label)
  }
  return out
}

/**
 * `text` with every unnamed girl's names swapped for her label, sparing any name a named girl in
 * the scene also answers to.
 */
function maskedText(text: string, girls: readonly AssistantGirl[]): string {
  const unnamed = girls.filter((girl) => girl.name === null)
  const spared = new Set(girls.flatMap((girl) => (girl.name === null ? [] : girl.names)))
  let out = text
  unnamed.forEach((girl, index) => {
    const label = unnamedLabel(index, unnamed.length)
    // Her whole name first, so "First Last" becomes one label rather than two.
    out = maskName(out, girl.names.join(' '), label)
    for (const name of girl.names) if (!spared.has(name)) out = maskName(out, name, label)
  })
  return out
}

/** The milestones between her and the reader that the player has watched happen. */
function milestoneSentences(who: string, flags: AssistantGirl['flags']): string[] {
  const lines: string[] = []
  if (flags.isLover) lines.push(`${who} and the reader are dating${flags.harem ? ', and she has agreed to share him' : ''}.`)
  if (flags.hadSex) lines.push(`${who} and the reader have slept together.`)
  else if (flags.hasKissed) lines.push(`${who} and the reader have kissed.`)
  if (flags.brokenUp > 0) {
    lines.push(`${who} and the reader have broken up ${flags.brokenUp === 1 ? 'once' : `${flags.brokenUp} times`}.`)
  }
  if (flags.friendZoned) lines.push(`The reader has friendzoned ${who}.`)
  if (flags.friendZonedBy) lines.push(`${who} has friendzoned the reader.`)
  if (flags.blocked) lines.push(`${who} has blocked the reader on Bunnyboard.`)
  else if (flags.gaveContactInfo) lines.push(`${who} has given the reader her number.`)
  return lines
}

/** One girl's entry under CAST. */
function girlLines(girl: AssistantGirl, label: string): string[] {
  if (girl.name === null) {
    return [`${label}: a girl in the scene who has not told the reader her name.`, '']
  }
  return [
    `${girl.name.toUpperCase()} (${girl.tag})`,
    ...milestoneSentences(girl.name, girl.flags),
    ...girl.profile,
    ...girl.record,
    ''
  ]
}

/** The rules every read of a scene is given, the same on every call. */
function systemLines(lessNsfwText: boolean): string[] {
  return [
    "You are the Story Assistant: a sharp, warm friend reading a Venus University dating story over the player's shoulder while they play it.",
    'The player plays the reader, the story\'s protagonist. Talk to the player as "you", and call the reader "you" too: what the reader did, the player did.',
    '',
    'WHAT YOU KNOW',
    'You know only what is written in the message, which is what the player has seen. Never invent events, history or facts about anybody.',
    "Nobody's private thoughts are given to you. Read each girl from what she has said and done, and say how sure you are where it matters.",
    'A girl written as UNNAMED GIRL has not told the reader her name. Never guess one or give her one, and never write the label itself: call her "she", or by how she comes across.',
    '',
    'COMMENTARY',
    'In "commentary", say what you make of the scene so far in a few short sentences, about 120 words at most: how it is going, how each girl seems to be taking you, what is building or at stake.',
    'Be candid and specific to this scene. No lists, no headings, and no retelling of what the player has just read.',
    'Where a QUESTION is given, "commentary" answers it instead, honestly and from what you know.',
    '',
    'WAYS FORWARD',
    'In "suggestions", offer three or four different things the reader could do next, from the scene as it stands: a bold one, a careful one, and one that takes the scene somewhere else entirely.',
    '"label" is two to five words naming it.',
    `"action" is the turn as the player would type it: first person, what the reader says in quotes and what he does, one or two sentences and under ${ASSISTANT_ACTION_LIMIT} characters, like: "Wait, you actually play?" I lean in, grinning.`,
    'An action is the reader trying something, never how it turns out: how she answers is the story\'s to tell.',
    'An action never names a girl written as UNNAMED GIRL; it calls her "her".',
    ...(lessNsfwText ? ['Keep the commentary and every suggestion short of explicit sex.'] : [])
  ]
}

/** The reply's shape: the commentary first, then the ways forward. */
function assistantSchema(): StructuredRequest['schema'] {
  return objectSchema('story_assistant', ['commentary', 'suggestions'], {
    commentary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'action'],
        properties: { label: { type: 'string' }, action: { type: 'string' } }
      }
    }
  })
}

/**
 * One read of the scene: the rules in `system`; then the world, the reader, the slot, the days
 * before, the cast, the story so far and the scene's tail, with the player's question last.
 */
export function buildStoryAssistantPrompt(context: AssistantContext): StructuredRequest {
  const unnamed = context.girls.filter((girl) => girl.name === null)
  const user = [
    'SETTING',
    context.setting.trim(),
    '',
    'READER',
    context.reader.trim(),
    '',
    'NOW',
    context.when,
    '',
    ...(context.earlier.length > 0 ? ['EARLIER', ...context.earlier.map((line) => `- ${line}`), ''] : []),
    'CAST',
    ...context.girls.flatMap((girl) =>
      girlLines(girl, unnamedLabel(unnamed.indexOf(girl), unnamed.length))
    ),
    ...(context.summary ? ['STORY SO FAR', context.summary, ''] : []),
    'SCENE SO FAR',
    ...context.lines,
    ...(context.question.trim() ? ['', 'QUESTION', context.question.trim()] : [])
  ].join('\n')
  return {
    system: systemLines(context.lessNsfwText).join('\n'),
    user: maskedText(user, context.girls),
    schema: assistantSchema(),
    cacheKey: 'story-assistant'
  }
}
