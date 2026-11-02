import { describe, expect, it } from 'vitest'
import { createDmLeadReader } from '../src/renderer/stores/textingStream'

describe('the DM reply lead', () => {
  it('returns the lead fields first and only once', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":true,"photoPrompt":"a \\"messages\\" sign","messages":['))
      .toEqual({ sendPhoto: true, photoPrompt: 'a "messages" sign' })
    expect(reader.feed('"hi"]}')).toBeUndefined()
  })
  it('returns nothing when messages comes first', () => {
    expect(createDmLeadReader().feed('{"messages":[],"sendPhoto":true}')).toBeUndefined()
  })
  it('waits for a key split across deltas', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":true,"mess')).toBeUndefined()
    expect(reader.feed('ages":[')).toEqual({ sendPhoto: true })
  })
  it('gives up on an unparseable prefix', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":tru,"messages":[')).toBeUndefined()
    expect(reader.feed(']}')).toBeUndefined()
  })
})

describe('top-level DM messages preview', () => {
  it.each([
    '{"lead":{"messages":["wrong"]},"messages":["right"]}',
    '{"lead":"messages","other":["wrong"],"messages":["right"]}'
  ])('ignores messages in a lead for every chunk boundary', async reply => {
    const { createTextExtractor } = await import('../src/renderer/stores/textingStream')
    for (let split = 0; split <= reply.length; split++) {
      const reader = createTextExtractor()
      expect([...reader.feed(reply.slice(0, split)), ...reader.feed(reply.slice(split))]).toEqual(['right'])
    }
  })
})
