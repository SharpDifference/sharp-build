import type { MiniGameDef } from '@shared/minigames'
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
  const answer = {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'stake'],
    properties: {
      answer: { type: 'string', enum: ['accept', 'decline'] },
      stake: { type: 'string' }
    }
  }
  return {
    ...request,
    user: [
      request.user,
      '',
      'MINI-GAME',
      `The reader has just asked ${name} to play ${game.name}: ${game.blurb}.`,
      `${name} decides for herself, in character and in this moment: she may jump at it, need talking into it, or say no.`,
      `Fill the "${FIELD}" field first. "answer" is "accept" only if she agrees to play right now, and "decline" otherwise. "stake" is what the two of them have settled is riding on the game, in one sentence, or "" if nothing is.`,
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

/** Her answer off a reply: whether she agreed, and the stake. A reply without one is a no. */
export function answerOf(reply: Readonly<Record<string, unknown>>): {
  accepted: boolean
  stake: string
} {
  const field = reply[FIELD]
  if (!field || typeof field !== 'object') return { accepted: false, stake: '' }
  const { answer, stake } = field as { answer?: unknown; stake?: unknown }
  return {
    accepted: answer === 'accept',
    stake: typeof stake === 'string' ? stake.trim() : ''
  }
}
