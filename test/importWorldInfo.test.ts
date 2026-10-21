import { describe, expect, it } from 'vitest'
import { importWorldInfo } from '../src/shared/lorebooks/importWorldInfo'

/**
 * What a SillyTavern World Info file becomes: the field mapping, and which entries are kept
 * but turned off because this game cannot match them as the file means.
 */

const FILE = {
  name: 'Harbor Town',
  entries: {
    '0': { uid: 7, key: ['Harbor', ' lighthouse '], comment: 'The harbor', content: 'A busy harbor.', constant: false, disable: false },
    '1': { uid: 8, key: [], comment: 'Weather', content: 'It always rains.', constant: true },
    '2': { uid: 9, key: ['mayor'], content: "The mayor is {{char}}'s uncle, and {{user}} knows it.", disable: true }
  }
}

describe('importWorldInfo', () => {
  it('maps a World Info entry onto a lorebook entry', () => {
    const result = importWorldInfo(FILE, 'book-1', 'harbor.json')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.book).toMatchObject({ id: 'book-1', name: 'Harbor Town', source: 'sillytavern' })
    expect(result.book.entries[0]).toEqual({
      uid: '7',
      name: 'The harbor',
      keys: ['Harbor', 'lighthouse'],
      text: 'A busy harbor.',
      enabled: true
    })
    // Constant becomes always-on, which needs no key.
    expect(result.book.entries[1]).toMatchObject({ always: true, keys: [], enabled: true })
    // The file's own disable is kept as off, with no conflict to explain.
    expect(result.book.entries[2]).toMatchObject({ enabled: false })
    expect(result.book.entries[2].conflict).toBeUndefined()
    expect(result.report.working).toBe(2)
    expect(result.report.macros).toEqual([
      { macro: '{{char}}', entries: 1 },
      { macro: '{{user}}', entries: 1 }
    ])
  })

  it('reads entries kept as an array the same way', () => {
    const array = importWorldInfo({ entries: Object.values(FILE.entries) }, 'b', 'harbor.json')
    const object = importWorldInfo({ entries: FILE.entries }, 'b', 'harbor.json')
    expect(array.ok && object.ok).toBe(true)
    if (array.ok && object.ok) expect(array.book.entries).toEqual(object.book.entries)
  })

  it('keeps what it cannot match as written, turned off with the reason', () => {
    const result = importWorldInfo(
      {
        entries: [
          { uid: 1, key: ['castle'], keysecondary: ['night'], selective: true, content: 'Needs two keys.' },
          { uid: 2, key: ['/dr(a|o)gon/i'], content: 'A regular expression.' },
          { uid: 3, key: [], comment: 'Keyless', content: 'Nothing triggers it.' },
          { uid: 4, key: ['empty'], content: '   ' }
        ]
      },
      'b',
      'castle.json'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.book.name).toBe('castle')
    expect(result.book.entries).toHaveLength(3)
    for (const entry of result.book.entries) {
      expect(entry.enabled).toBe(false)
      expect(entry.conflict).toBeTruthy()
    }
    // The keyless entry's name stands in as its key, since the book refuses an entry nothing can trigger.
    expect(result.book.entries[2].keys).toEqual(['Keyless'])
    expect(result.report.off).toHaveLength(3)
    expect(result.report.dropped).toEqual([{ name: 'empty', reason: 'It has no text.' }])
  })

  it('refuses a file with no entries', () => {
    expect(importWorldInfo({ entries: {} }, 'b', 'x.json').ok).toBe(false)
    expect(importWorldInfo([], 'b', 'x.json').ok).toBe(false)
  })
})
