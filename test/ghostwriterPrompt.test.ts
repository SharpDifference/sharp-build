import { describe, expect, it } from 'vitest'
import { converterRequestOf, converterTextOf, converterTextOfTag } from '../src/shared/ghostwriterPrompt'
import type { PromptPart } from '../src/shared/promptText'
import type { StructuredRequest } from '../src/shared/types'

/**
 * The converter writes the summary a save keeps, so its cut request must still carry what the
 * summary is built from — the story and scene so far and the turn — and a mod's field
 * instructions, while the writer's context is dropped; an edited prompt sends the whole request.
 */

const PARTS: PromptPart[] = [
  { id: 'persona', role: 'system', text: 'PERSONA TEXT' },
  { id: 'jsonRules', role: 'system', text: 'JSON RULES\nrule' },
  { id: 'setting', role: 'system', text: 'SETTING\ncampus' },
  { id: 'cast', role: 'user', text: 'CAST\nada_lovelace bio' },
  { id: 'now', role: 'user', text: 'NOW\nCurrent bg: library' },
  { id: 'lorebook', role: 'user', text: 'LOREBOOK\nlore' },
  { id: 'storySoFar', role: 'user', text: 'STORY SO FAR\nearlier' },
  { id: 'sceneSoFar', role: 'user', text: 'SCENE SO FAR\nlines' },
  { id: 'yourTurn', role: 'user', text: 'YOUR TURN\nwrite the summary' }
]

function request(overrides: Partial<StructuredRequest> = {}): StructuredRequest {
  const side = (role: PromptPart['role']): string =>
    PARTS.filter((part) => part.role === role).map((part) => part.text).join('\n\n')
  return {
    system: side('system'),
    // A mod's addition sits outside every part, just before the turn.
    user: side('user').replace('YOUR TURN', 'GROUP PHOTO\nFill "groupPost"\n\nYOUR TURN'),
    schema: {
      name: 'scene',
      schema: {
        type: 'object',
        properties: {
          lines: { type: 'array', items: { properties: { speaker: { type: 'string', enum: ['', 'ada_lovelace'] } } } },
          summary: { type: 'string' },
          vars: { type: 'array' }
        }
      }
    },
    parts: PARTS,
    logFrom: 4,
    ...overrides
  }
}

describe('the converter request', () => {
  it('keeps the summary sources and mod instructions, and drops the writer context and vars', () => {
    const text = converterTextOf(request())
    expect(text).not.toBeNull()
    const sent = converterRequestOf(request(), 'Ada: "Hi."', converterTextOfTag(structuredClone({ converter: text })))

    for (const kept of ['JSON RULES\nrule', 'ada_lovelace']) expect(sent.system).toContain(kept)
    for (const kept of ['NOW\n', 'STORY SO FAR\nearlier', 'SCENE SO FAR\nlines', 'YOUR TURN\n', 'Fill "groupPost"', 'Ada: "Hi."']) {
      expect(sent.user).toContain(kept)
    }
    for (const dropped of ['PERSONA TEXT', 'SETTING', 'bio', 'LOREBOOK']) {
      expect(sent.system + sent.user).not.toContain(dropped)
    }
    const properties = sent.schema.schema.properties as Record<string, unknown>
    expect(Object.keys(properties)).toEqual(['lines', 'summary'])
    expect(sent.logFrom).toBeUndefined()
  })

  it('sends the whole request where the player edited the prompt', () => {
    const edited = request({ user: 'my own words' })
    expect(converterTextOf(edited)).toBeNull()
    const sent = converterRequestOf(edited, 'draft', converterTextOfTag({}))
    expect(sent.system.startsWith(edited.system)).toBe(true)
    expect(sent.user.startsWith('my own words')).toBe(true)
    expect(sent.schema).toBe(edited.schema)
  })
})
