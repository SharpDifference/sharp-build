import { describe, expect, it } from 'vitest'
import { loreBookToKeep, loreIndexToKeep, readLoreIndex } from '../src/shared/lorebooks/rules'

const entry = { uid: 'e1', keys: [' Venus ', '', 'Mars'], text: 'Lore.', enabled: true }
const book = { id: 'b1', name: 'Book', source: 'native' as const, entries: [entry] }

describe('loreBookToKeep', () => {
  it('trims keys and drops blank ones', () => {
    expect(loreBookToKeep(book).entries[0].keys).toEqual(['Venus', 'Mars'])
  })

  it('refuses an entry with no keys that is not always on, and accepts one that is', () => {
    expect(() => loreBookToKeep({ ...book, entries: [{ ...entry, keys: [' '] }] })).toThrow()
    expect(loreBookToKeep({ ...book, entries: [{ ...entry, keys: [], always: true }] }).entries[0].always).toBe(true)
  })

  it('refuses an unsafe id', () => {
    expect(() => loreBookToKeep({ ...book, id: '../x' })).toThrow()
  })
})

describe('the index', () => {
  it('refuses another schema version', () => {
    expect(() => readLoreIndex({ schemaVersion: 2, on: [] }, new Set(), 'index.json')).toThrow(/another version/)
  })

  it('keeps only existing books on, and drops empty or default overrides', () => {
    const kept = loreIndexToKeep(
      { on: ['b1', 'gone', 'b1'], shipped: { a: { enabled: true, text: '  ' }, b: { keys: [' k '], enabled: false } } },
      new Set(['b1'])
    )
    expect(kept.on).toEqual(['b1'])
    expect(kept.shipped).toEqual({ b: { keys: ['k'], enabled: false } })
  })
})
