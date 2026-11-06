import type { StructuredRequest } from './types'

/** What Ghostwriter adds to a scene request for each of its two calls: the writer's and the converter's. */

/** The id of the part holding the game's JSON rules, which the writer is not given. */
const JSON_RULES_PART = 'jsonRules'

const WRITER_BLOCK = [
  'GHOSTWRITING',
  'Another writer will turn your draft into the game\'s script, so write it as plain prose and nothing else: no JSON, no code blocks, no headings and no notes to anybody.',
  'Ignore every instruction above about JSON, schemas, fields, the summary, actions, sprites, CGs, backgrounds and end_scene. Those are the other writer\'s job. Everything else still stands: who everyone is, what they know, how the scene should go and when it should end.',
  'Write narration as ordinary paragraphs. Give each line of dialogue a line of its own, starting with the speaker\'s first name and a colon, like this: <first name>: "You\'re late."'
].join('\n')

const WRITER_REMINDER = 'Write your draft now, as prose alone.'

const CONVERTER_BLOCK = [
  'CONVERTING A DRAFT',
  'This time the scene has already been written for you, as a prose draft under DRAFT at the end of the user message. Turn it into the JSON reply, following the JSON RULES above.',
  'Keep the draft\'s words. Split it into lines, give each line its speaker, and add the actions and bg the JSON RULES call for.',
  'Edit lightly, and only where the draft contradicts what you know: somebody speaks or appears who isn\'t in the CAST, a place that isn\'t among the backgrounds, a fact the rest of this prompt rules out. Change the least you can to fix it.',
  'Don\'t add events, dialogue or narration the draft doesn\'t have, and don\'t leave any out.',
  'Any instruction above on how long the reply should be or how it should go is already answered by the draft.',
  'If the reply has an end_scene field, decide it from the draft, following the instructions in YOUR TURN.',
  'If it has a summary field, write it yourself as YOUR TURN asks, counting the draft as the lines you just wrote.'
].join('\n')

/** The system text without its first copy of the JSON rules, the blank lines around the gap closed up. */
function withoutJsonRules(request: StructuredRequest): string {
  const text = request.parts?.find((part) => part.id === JSON_RULES_PART && part.role === 'system')?.text
  const at = text ? request.system.indexOf(text) : -1
  if (!text || at < 0) return request.system
  const before = request.system.slice(0, at).replace(/\n+$/, '')
  const after = request.system.slice(at + text.length).replace(/^\n+/, '')
  return before && after ? `${before}\n\n${after}` : before + after
}

/** The scene request as the writer gets it: no JSON rules, and the instruction to write prose alone. */
export function writerRequestOf(request: StructuredRequest): StructuredRequest {
  return {
    ...request,
    system: `${withoutJsonRules(request)}\n\n${WRITER_BLOCK}`,
    user: `${request.user}\n\n${WRITER_REMINDER}`
  }
}

/** The scene request as the converter gets it: the draft added, and the instruction to convert it. */
export function converterRequestOf(request: StructuredRequest, draft: string): StructuredRequest {
  return {
    ...request,
    system: `${request.system}\n\n${CONVERTER_BLOCK}`,
    user: `${request.user}\n\nDRAFT\n${draft}\n\nConvert the DRAFT into the JSON reply.`
  }
}
