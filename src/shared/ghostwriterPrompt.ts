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
  'Another writer will turn your draft into the game\'s script, so write it as plain prose: no JSON, no code blocks, no headings and no notes to anybody but the stage notes below.',
  'Ignore every instruction above about JSON, schemas, fields, the summary, actions, sprites, CGs, backgrounds and end_scene. Those are the other writer\'s job. Everything else still stands: who everyone is, what they know, how the scene should go and when it should end.',
  'Write narration as ordinary paragraphs. Give each line of dialogue a line of its own, starting with the speaker\'s first name and a colon, like this: <first name>: "You\'re late." The reader\'s own lines start with "You:" instead.',
  'Where something changes that the other writer has to stage, you may add a stage note on a line of its own, starting with "Action:": a move to a new place, somebody arriving or leaving, a change of clothes. For example: Action: they now move to the reader\'s room.'
].join('\n')

/** The line before the places the game can show, which the writer is given out of the JSON rules. */
const WRITER_PLACES = 'The game can show these places, so set the scene in them and name them in your stage notes. A girl\'s own room, where her character info names one, works too.'

/** The bg id of the reader's room, a single in Lowrise 4. */
const READER_ROOM_BG = 'lowrise_dorm_room'

const WRITER_REMINDER = 'Write your draft now, as prose alone, with any stage notes on lines of their own.'

/**
 * Who the converter is, in place of RITA's persona, where the writer's context has been cut from
 * its request: her editor, keeping her voice in any line it words itself.
 */
const CONVERTER_PERSONA =
  'You are RITA\'s script editor. RITA writes reader-POV romance in present tense and second person, and you turn her drafts into the script for a visual novel. Any line you word yourself keeps her voice: present tense, second person, and no semicolons or em dashes. You always return a single, fully-formed JSON object matching the provided schema exactly.'

const CONVERTER_BLOCK = [
  'CONVERTING A DRAFT',
  'The scene has already been written, as a prose draft under DRAFT at the end of the user message. Turn it into the JSON reply, following the JSON RULES above.',
  'A line of the draft starting with "Action:" is a stage note, not part of the scene. Carry it out with the actions and bg the JSON RULES call for, on the line after it, or on the line before it where it ends the draft, and never write it as a line of its own.',
  'Only the cast speak lines of their own. Anybody else\'s words become narration that reports what they say instead of quoting it: the reader\'s lines, which start with "You:", in the second person, like this: You nod, saying that you\'ve got enough time. Anybody else\'s, such as a teacher\'s, in the third person, like this: Professor Esposito launches into a ramble about the theory of mechanics.',
  'Apart from stage notes and those lines, keep the draft\'s words. Split it into lines, give each line its speaker, and add the actions and bg the JSON RULES call for.',
  'Don\'t change what anybody says or does, don\'t add events, dialogue or narration the draft doesn\'t have, and don\'t leave any out.',
  'Any instruction above on how long the reply should be or how it should go is already answered by the draft.',
  'If the reply has an end_scene field, decide it from the draft, following the instructions in YOUR TURN.',
  'If it has a summary field, write it yourself as YOUR TURN asks, counting the draft as the lines you just wrote.'
].join('\n')

/** The fields the Mini Games mod adds to a scene reply, filled from what happens in the draft. */
const MINI_GAME_FIELDS: readonly string[] = ['minigame', 'minigameInvite']

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

/** The JSON rules part's text, where the request carries it in its system text. */
function jsonRulesOf(request: StructuredRequest): string | undefined {
  return request.parts?.find((part) => part.id === JSON_RULES_PART && part.role === 'system')?.text
}

/** The system text without its first copy of the JSON rules. */
function withoutJsonRules(request: StructuredRequest): string {
  const text = jsonRulesOf(request)
  return (text && cut(request.system, text)) ?? request.system
}

/** The writer's list of places: the JSON rules' background lines under a line of its own; empty where they list none. */
function writerPlacesOf(request: StructuredRequest): string {
  const lines = (jsonRulesOf(request) ?? '').split('\n').filter((line) => /^(Interiors|Exteriors): /.test(line))
  return lines.length > 0 ? [WRITER_PLACES, ...lines].join('\n') : ''
}

/** The strings a schema property's enum lists; none where it lists none. */
function enumOf(property: unknown): string[] {
  const values = recordOf(property)?.enum
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && value !== '') : []
}

/**
 * What the converter is told about staging in place of the cast, read off the schema: each girl's
 * key, the outfit suffixes her sprites are offered under and her room, then the reader's room.
 */
function stagingOf(schema: StructuredRequest['schema']): string {
  const line = recordOf(recordOf(recordOf(recordOf(schema.schema.properties)?.lines)?.items)?.properties)
  const keys = enumOf(line?.speaker)
  const actions = enumOf(recordOf(line?.actions)?.items)
  const bgs = enumOf(line?.bg)

  const girls = keys.map((key) => {
    // `sprite:<key>,<emotion>_<suffix>`: an emotion is one word, so the suffix is what follows its first underscore.
    const suffixes = new Set<string>()
    for (const action of actions) {
      if (!action.startsWith(`sprite:${key},`)) continue
      const ref = action.slice(`sprite:${key},`.length)
      const at = ref.indexOf('_')
      if (at > 0) suffixes.add(`_${ref.slice(at + 1)}`)
    }
    const room = `${key}_room`
    const details = [
      ...(suffixes.size > 0 ? [`Outfit suffixes: ${[...suffixes].join(', ')}`] : []),
      ...(bgs.includes(room) ? [`Her room: ${room}`] : [])
    ]
    return details.length > 0 ? `${[key, ...details].join('. ')}.` : key
  })

  const blocks = [
    ...(keys.length > 0
      ? [
          [
            'CHARACTER KEYS',
            ...girls,
            'Each girl\'s dialogue goes under the key that starts with her first name.'
          ].join('\n')
        ]
      : []),
    ...(bgs.includes(READER_ROOM_BG) ? [`The reader's room is ${READER_ROOM_BG}.`] : [])
  ]
  return blocks.join('\n\n')
}

/**
 * The converter's instructions, ending on the mini-game fields the schema carries where it carries
 * any, so the converter fills them from the draft rather than taking them as answered by it.
 */
function converterBlockOf(schema: StructuredRequest['schema']): string {
  const properties = recordOf(schema.schema.properties) ?? {}
  const fields = MINI_GAME_FIELDS.filter((field) => field in properties)
  if (fields.length === 0) return CONVERTER_BLOCK
  return [
    CONVERTER_BLOCK,
    `Fill the reply's ${fields.join(' and ')} ${fields.length > 1 ? 'fields' : 'field'} from what happens in the draft, as the mini-game instructions ask. A game is offered, agreed to or turned down only where the draft says so.`
  ].join('\n')
}

/** The schema without the `vars` field Prompt Studio adds, which the converter is never told how to fill. */
function withoutVars(schema: StructuredRequest['schema']): StructuredRequest['schema'] {
  const properties = recordOf(schema.schema.properties)
  if (!properties || !('vars' in properties)) return schema
  const { vars: _vars, ...rest } = properties
  return { ...schema, schema: { ...schema.schema, properties: rest } }
}

/**
 * The scene request as the writer gets it: no JSON rules but the places they list, and the
 * instruction to write prose alone.
 */
export function writerRequestOf(request: StructuredRequest): StructuredRequest {
  const places = writerPlacesOf(request)
  return {
    ...request,
    system: [withoutJsonRules(request), WRITER_BLOCK, ...(places ? [places] : [])].join('\n\n'),
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

  const staging = stagingOf(request.schema)
  return {
    system: [CONVERTER_PERSONA, system, ...(staging ? [staging] : []), converterBlockOf(request.schema)].join('\n\n'),
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
    return { ...request, system: `${request.system}\n\n${converterBlockOf(request.schema)}`, user: `${request.user}\n\n${tail}` }
  }
  // The user text is new, so an offset into the old one points at nothing.
  const { logFrom: _logFrom, ...rest } = request
  return { ...rest, system: text.system, user: `${text.user}\n\n${tail}`, schema: withoutVars(request.schema) }
}
