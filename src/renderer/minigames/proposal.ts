import { settledOptions, type MiniGameDef } from '@shared/minigames'
import type { StructuredRequest } from '@shared/types'

/** How a proposed game rides on a scene request, and how her answer is read off the reply. */

/** The reply field her answer comes back in. */
const FIELD = 'minigame'

/**
 * The request for the turn that carries a proposal: her answer asked for as a field of the
 * reply, ahead of the lines so they are written knowing it, and what the field means said at the
 * foot of the prompt, below everything a cache could hold.
 */
export function withProposal(
  request: StructuredRequest,
  game: MiniGameDef,
  name: string
): StructuredRequest {
  const schema = request.schema.schema as {
    required?: string[]
    properties?: Record<string, unknown>
  }
  const options = game.options ?? []
  /** A whole number in a range, asked for as one of its numerals: every provider takes that. */
  const numerals = (min: number, max: number): string[] =>
    Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
  const answer = {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'stake', ...(options.length > 0 ? ['options'] : [])],
    properties: {
      answer: { type: 'string', enum: ['accept', 'decline'] },
      stake: { type: 'string' },
      ...(options.length > 0
        ? {
            options: {
              type: 'object',
              additionalProperties: false,
              required: options.map((option) => option.id),
              properties: Object.fromEntries(
                options.map((option) => [
                  option.id,
                  { type: 'string', enum: numerals(option.min, option.max) }
                ])
              )
            }
          }
        : {})
    }
  }
  return {
    ...request,
    user: [
      request.user,
      '',
      'MINI-GAME',
      `The reader has just asked ${name} to play ${game.name}: ${game.blurb}.`,
      `How it is played: ${game.format}`,
      ...(options.length > 0
        ? [
            'What the two of them may settle about it, in the "options" of the field:',
            ...options.map(
              (option) =>
                `- "${option.id}": ${option.describe}. From ${option.min} to ${option.max}; ${option.default} unless something else was said.`
            )
          ]
        : []),
      `That is the whole of what the table can do. The game is run for real, by its rules as written here, and nothing either of them says can change them. If the reader asks for a way of playing this does not cover, ${name} cannot agree to that version: she steers it back to what the game does, in character, or says no.`,
      `${name} decides for herself, in character and in this moment: she may jump at it, need talking into it, or say no.`,
      `Fill the "${FIELD}" field first. "answer" is "accept" only if she agrees to play right now, and "decline" otherwise. "stake" is what the two of them have settled is riding on the game, in one sentence written the way your narration is, with the reader as "you" ("If you win, she ..."), or "" if nothing is.`,
      'If she accepts, write her saying yes and the two of them getting set up, and stop there. Do NOT play the game, deal a card, or say who wins: the game is played for real straight after your lines, and you will be told how it went. Do not send end_scene.',
      'If she declines, carry the scene on from her answer as you normally would.'
    ].join('\n'),
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        required: [FIELD, ...(schema.required ?? [])],
        properties: { [FIELD]: answer, ...(schema.properties ?? {}) }
      }
    }
  }
}

/**
 * Her answer off a reply: whether she agreed, the stake, and how the game is to be played. A
 * reply without one is a no.
 */
export function answerOf(
  reply: Readonly<Record<string, unknown>>,
  game: MiniGameDef
): {
  accepted: boolean
  stake: string
  options: Record<string, number>
} {
  const field = reply[FIELD]
  if (!field || typeof field !== 'object') {
    return { accepted: false, stake: '', options: settledOptions(game, undefined) }
  }
  const { answer, stake, options } = field as {
    answer?: unknown
    stake?: unknown
    options?: unknown
  }
  return {
    accepted: answer === 'accept',
    stake: typeof stake === 'string' ? stake.trim() : '',
    options: settledOptions(game, options)
  }
}
