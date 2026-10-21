import { describe, expect, it } from 'vitest'
import type { LoreBook } from '@shared/lorebooks/types'
import { effectiveLore } from '../src/renderer/prompts/effectiveLore'
import {
  availableLore,
  LOREBOOK,
  loreKeyOf,
  loreTextForKey,
  lorebookBlock,
  SHIPPED_LORE
} from '../src/renderer/prompts/lorebook'

/**
 * The lorebook as the player's edits leave it: shipped ids keep their keys, an entry that is
 * turned off never matches, and with nothing stored the result is the shipped lorebook.
 */

const LIBRARY = LOREBOOK.find((entry) => entry.id === 'kendall_library')!
const VSA = LOREBOOK.find((entry) => entry.keys[0] === 'VSA')!

function book(entries: LoreBook['entries']): Record<string, LoreBook> {
  return { b1: { schemaVersion: 1, id: 'b1', name: 'Mine', source: 'native', entries } }
}

const everyKey = LOREBOOK.flatMap((entry) => entry.keys).join(' ')

describe('effectiveLore', () => {
  it('is the shipped lorebook where nothing is stored', () => {
    const lore = effectiveLore(undefined, {}, [])
    expect(lorebookBlock(everyKey, ['x'], ['y'], undefined, lore)).toEqual(
      lorebookBlock(everyKey, ['x'], ['y'], undefined, SHIPPED_LORE)
    )
    expect(availableLore(lore)).toEqual(availableLore(SHIPPED_LORE))
  })

  it('keeps an id entry on its shipped keys whatever a key edit says, and lets it gain keys', () => {
    const lore = effectiveLore(
      { shipped: { kendall_library: { keys: ['zzz'], addedKeys: ['reading room'] } } },
      {},
      []
    )
    expect(lorebookBlock('the Kendall', [], [], undefined, lore).join('\n')).toContain(LIBRARY.text)
    expect(lorebookBlock('the reading rooms', [], [], undefined, lore).join('\n')).toContain(LIBRARY.text)
    expect(lorebookBlock('zzz', [], [], undefined, lore)).toEqual([])
  })

  it('replaces the keys of an entry that has no id, and ignores added ones', () => {
    const lore = effectiveLore({ shipped: { VSA: { keys: ['council'], addedKeys: ['senate'] } } }, {}, [])
    expect(lorebookBlock('the council', [], [], undefined, lore).join('\n')).toContain(VSA.text)
    expect(lorebookBlock('the VSA', [], [], undefined, lore)).toEqual([])
    expect(lorebookBlock('the senate', [], [], undefined, lore)).toEqual([])
    // A grab bag still names the edited entry as it always did.
    const edited = availableLore(lore).find((entry) => entry.keys.includes('council'))!
    expect(loreKeyOf(edited)).toBe('VSA')
  })

  it('sends an edited text, and the same one where a workplace states it', () => {
    const lore = effectiveLore({ shipped: { kendall_library: { text: 'The library, edited.' } } }, {}, [])
    expect(loreTextForKey('Kendall', lore)).toBe('The library, edited.')
    const block = lorebookBlock('the Kendall', [loreTextForKey('Kendall', lore)!], [], undefined, lore)
    expect(block.filter((line) => line === 'The library, edited.')).toHaveLength(1)
  })

  it('never matches an entry the player turned off', () => {
    const lore = effectiveLore({ shipped: { kendall_library: { enabled: false } } }, {}, [])
    expect(lorebookBlock('the Kendall library', [], [], undefined, lore)).toEqual([])
    expect(availableLore(lore).some((entry) => entry.id === 'kendall_library')).toBe(false)
    expect(loreTextForKey('Kendall', lore)).toBeNull()
  })

  it('prints always-on entries of books that are on, and matches the rest by key', () => {
    const books = book([
      { uid: 'a', keys: [], text: 'Always true.', enabled: true, always: true },
      { uid: 'b', keys: ['dragon'], text: 'Dragons nest here.', enabled: true },
      { uid: 'c', keys: ['wyrm'], text: 'Switched off.', enabled: false }
    ])
    const lore = effectiveLore(undefined, books, ['b1'])
    const block = lorebookBlock('a quiet day', [], [], undefined, lore)
    expect(block.slice(0, 3)).toEqual(['LOREBOOK', '', 'Always true.'])
    expect(lorebookBlock('a dragon and a wyrm', [], [], undefined, lore).join('\n')).toContain('Dragons nest here.')
    expect(lorebookBlock('a wyrm', [], [], undefined, lore).join('\n')).not.toContain('Switched off.')
    // A book that is not on says nothing.
    expect(lorebookBlock('a dragon', [], [], undefined, effectiveLore(undefined, books, []))).toEqual([])
  })
})
