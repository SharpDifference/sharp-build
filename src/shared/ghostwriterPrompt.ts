import type { StructuredRequest } from './types'

/** What Ghostwriter adds to a scene request for each of its two calls: the writer's and the converter's. */

/** The id of the part holding the game's JSON rules, which the writer is not given. */
const JSON_RULES_PART = 'jsonRules'

/** The id of the part holding the turn's instructions, which say how the summary and end_scene are filled. */
const YOUR_TURN_PART = 'yourTurn'

/**
 * The parts only the writer needs, cut from the converter's request: who RITA is, the world, the
 * reader, the cast, the class, the lorebook and the mods' notes.
 */
const CONTEXT_PARTS: readonly string[] = ['persona', 'setting', 'reader', 'cast', 'class', 'lorebook', 'modLines']

const WRITER_BLOCK = [
  'GHOSTWRITING',
  'Another writer will turn your draft into the game\'s script, so write it as plain prose and nothing else: no JSON, no code blocks, no headings and no notes to anybody.',
  'Ignore every instruction above about JSON, schemas, fields, the summary, actions, sprites, CGs, backgrounds and end_scene. Those are the other writer\'s job. Everything else still stands: who everyone is, what they know, how the scene should go and when it should end.',
  'Write narration as ordinary paragraphs. Give each line of dialogue a line of its own, starting with the speaker\'s first name and a colon, like this: <first name>: "You\'re late."'
].join('\n')

const WRITER_REMINDER = 'Write your draft now, as prose alone.'

/** Who the converter is, in place of RITA, where the writer's context has been cut from its request. */
const CONVERTER_PERSONA =
  'You turn scenes drafted in prose into the script for a visual novel. You always return a single, fully-formed JSON object matching the provided schema exactly.'

const CONVERTER_BLOCK = [
  'CONVERTING A DRAFT',
  'The scene has already been written, as a prose draft under DRAFT at the end of the user message. Turn it into the JSON reply, following the JSON RULES above.',
  'Keep the draft\'s words. Split it into lines, give each line its speaker, and add the actions and bg the JSON RULES call for.',
  'Don\'t change what anybody says or does, don\'t add events, dialogue or narration the draft doesn\'t have, and don\'t leave any out.',
  'Any instruction above on how long the reply should be or how it should go is already answered by the draft.',
  'If the reply has an end_scene field, decide it from the draft, following the instructions in YOUR TURN.',
  'If it has a summary field, write it yourself as YOUR TURN asks, counting the draft as the lines you just wrote.'
].join('\n')

/** The converter's system text and the user text its draft follows, cut from the scene request in the window. */
export interface ConverterText {
  system: string
  user: string
}

/** The value as a plain object, or undefined. */
function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/** `side` with the first copy of `text` cut out and the blank lines around the gap closed up; null where it is not there. */
function cut(side: string, text: string): string | null {
  const at = text ? side.indexOf(text) : -1
  if (at < 0) return null
  const before = side.slice(0, at).replace(/\n+$/, '')
  const after = side.slice(at + text.length).replace(/^\n+/, '')
  return before && after ? `${before}\n\n${after}` : before + after
}

/** The system text without its first copy of the JSON rules. */
function withoutJsonRules(request: StructuredRequest): string {
  const text = request.parts?.find((part) => part.id === JSON_RULES_PART && part.role === 'system')?.text
  return (text && cut(request.system, text)) ?? request.system
}

/** The cast's character keys, read off the schema's speaker enum; none for a solo scene. */
function characterKeysOf(schema: StructuredRequest['schema']): string[] {
  const lines = recordOf(recordOf(schema.schema.properties)?.lines)
  const speaker = recordOf(recordOf(recordOf(lines?.items)?.properties)?.speaker)
  const keys = speaker?.enum
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string' && key !== '') : []
}

/** The schema without the `vars` field Prompt Studio adds, which the converter is never told how to fill. */
function withoutVars(schema: StructuredRequest['schema']): StructuredRequest['schema'] {
  const properties = recordOf(schema.schema.properties)
  if (!properties || !('vars' in properties)) return schema
  const { vars: _vars, ...rest } = properties
  return { ...schema, schema: { ...schema.schema, properties: rest } }
}

/** The scene request as the writer gets it: no JSON rules, and the instruction to write prose alone. */
export function writerRequestOf(request: StructuredRequest): StructuredRequest {
  return {
    ...request,
    system: `${withoutJsonRules(request)}\n\n${WRITER_BLOCK}`,
    user: `${request.user}\n\n${WRITER_REMINDER}`
  }
}

/**
 * The converter's text, cut from the scene request as the game and its mods built it, before any
 * preset is laid over it: the JSON rules, the stage, the story and scene so far, the turn, and
 * whatever else the mods added, without the writer's context. Null where the JSON rules or the
 * turn cannot be found, as after the player edits a failed prompt.
 */
export function converterTextOf(request: StructuredRequest): ConverterText | null {
  const parts = request.parts ?? []
  const found = (id: string): boolean =>
    parts.some((part) => part.id === id && part.text !== '' && request[part.role].includes(part.text))
  if (!found(JSON_RULES_PART) || !found(YOUR_TURN_PART)) return null

  let system = request.system
  let user = request.user
  for (const part of parts) {
    if (!CONTEXT_PARTS.includes(part.id) || part.text === '') continue
    if (part.role === 'system') system = cut(system, part.text) ?? system
    else user = cut(user, part.text) ?? user
  }

  const keys = characterKeysOf(request.schema)
  const keyBlock = [
    'CHARACTER KEYS',
    keys.join(', '),
    'Each girl\'s dialogue goes under the key that starts with her first name. Anyone else who speaks does so in a narration line.'
  ].join('\n')
  return {
    system: [CONVERTER_PERSONA, system, ...(keys.length > 0 ? [keyBlock] : []), CONVERTER_BLOCK].join('\n\n'),
    user
  }
}

/** The converter's text a scene call was tagged with, where the tag carries a well-formed one. */
export function converterTextOfTag(tag: unknown): ConverterText | undefined {
  const text = recordOf(recordOf(tag)?.converter)
  return typeof text?.system === 'string' && typeof text.user === 'string'
    ? { system: text.system, user: text.user }
    : undefined
}

/**
 * The scene request as the converter gets it: the window's cut text where the call carries one,
 * else the whole request; then the draft, and the instruction to convert it.
 */
export function converterRequestOf(
  request: StructuredRequest,
  draft: string,
  text?: ConverterText
): StructuredRequest {
  const tail = `DRAFT\n${draft}\n\nConvert the DRAFT into the JSON reply.`
  if (!text) {
    return { ...request, system: `${request.system}\n\n${CONVERTER_BLOCK}`, user: `${request.user}\n\n${tail}` }
  }
  // The user text is new, so an offset into the old one points at nothing.
  const { logFrom: _logFrom, ...rest } = request
  return { ...rest, system: text.system, user: `${text.user}\n\n${tail}`, schema: withoutVars(request.schema) }
}
