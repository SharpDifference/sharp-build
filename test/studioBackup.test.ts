import { describe, expect, it } from 'vitest'
import { nativeDefaultPreset } from '../src/shared/presets/gameParts'
import {
  buildLorebooksBackup,
  buildPresetsBackup,
  buildPromptsBackup,
  mergeLorebooks,
  mergePresets,
  mergePrompts,
  parseStudioBackup,
  presetFromBackup
} from '../src/shared/presets/studioBackup'

const lorebook = (id: string, text = 'Lore.') => ({
  schemaVersion: 1,
  id,
  name: id,
  source: 'native' as const,
  entries: [{ uid: 'e1', keys: ['Venus'], text, enabled: true }]
})

describe('a presets backup', () => {
  it('merges by id with the file winning, and the file\'s active preset in force', () => {
    const file = buildPresetsBackup([nativeDefaultPreset('a'), nativeDefaultPreset('b')], 'b')
    const merge = mergePresets(['a', 'c'], file)
    expect(merge).toMatchObject({ active: 'b', added: 1, replaced: 1 })
    expect(merge.save.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('is refused whole when one preset is malformed or the active one is missing', () => {
    const good = buildPresetsBackup([nativeDefaultPreset('a')], 'a')
    expect(parseStudioBackup('presets', JSON.stringify(good)).ok).toBe(true)
    const broken = { ...good, presets: [{ ...good.presets[0], blocks: 'no' }] }
    expect(parseStudioBackup('presets', JSON.stringify(broken)).ok).toBe(false)
    expect(parseStudioBackup('presets', JSON.stringify({ ...good, active: 'zzz' })).ok).toBe(false)
  })

  it('of one preset imports as a copy under a fresh id, and one of several is refused', () => {
    const one = buildPresetsBackup([{ ...nativeDefaultPreset('a'), name: 'Mine' }], 'a')
    const imported = presetFromBackup(JSON.stringify(one), 'fresh')
    expect(imported).toMatchObject({ ok: true, preset: { id: 'fresh', name: 'Mine' } })
    expect(imported?.ok && 'schemaVersion' in imported.preset).toBe(false)
    const several = buildPresetsBackup([nativeDefaultPreset('a'), nativeDefaultPreset('b')], 'a')
    expect(presetFromBackup(JSON.stringify(several), 'fresh')?.ok).toBe(false)
    expect(presetFromBackup(JSON.stringify({ prompts: [] }), 'fresh')).toBeNull()
  })
})

describe('a prompts backup', () => {
  it('merges block by block and size by size, leaving what the file does not hold', () => {
    const current = { schemaVersion: 1, blocks: { 'persona.solo': 'mine', 'persona.texting': 'kept' }, classCatalog: { pe: 3, filler: 2 } }
    const file = { schemaVersion: 1, blocks: { 'persona.solo': 'theirs' }, classCatalog: { pe: 7 } }
    const merged = mergePrompts(current as never, file as never)
    expect(merged.blocks).toEqual({ 'persona.solo': 'theirs', 'persona.texting': 'kept' })
    expect(merged.classCatalog).toEqual({ pe: 7, filler: 2 })
  })

  it('is refused when its record is not valid', () => {
    const good = buildPromptsBackup({ schemaVersion: 1, blocks: { 'persona.solo': 'x' } as never })
    expect(parseStudioBackup('prompts', JSON.stringify(good)).ok).toBe(true)
    const bad = { ...good, prompts: { schemaVersion: 1, blocks: { 'persona.solo': 4 } } }
    expect(parseStudioBackup('prompts', JSON.stringify(bad)).ok).toBe(false)
  })
})

describe('a lorebooks backup', () => {
  const index = (shipped: object | undefined, on: string[]) => ({ schemaVersion: 1, ...(shipped ? { shipped } : {}), on })

  it('merges books by id and shipped edits entry by entry, the file winning', () => {
    const current = {
      index: index({ a: { text: 'mine', addedKeys: ['x'] }, b: { text: 'kept' } }, ['b1']),
      books: [lorebook('b1', 'old')]
    }
    const file = buildLorebooksBackup(index({ a: { text: 'theirs' } }, ['b1', 'b2']) as never, [
      lorebook('b1', 'new'),
      lorebook('b2')
    ])
    const merge = mergeLorebooks(current as never, file)
    expect(merge.index.shipped).toEqual({ a: { text: 'theirs' }, b: { text: 'kept' } })
    expect(merge.index.on).toEqual(['b1', 'b2'])
    expect(merge).toMatchObject({ added: 1, replaced: 1, edits: 1 })
  })

  it('leaves books switched on or off as they are when the file does not have them on', () => {
    const current = { index: index(undefined, ['b1']), books: [lorebook('b1'), lorebook('b3')] }
    const file = buildLorebooksBackup(index(undefined, []) as never, [lorebook('b2')])
    expect(mergeLorebooks(current as never, file).index.on).toEqual(['b1'])
  })

  it('is refused whole when one book is malformed', () => {
    const good = buildLorebooksBackup(index(undefined, []) as never, [lorebook('b1')])
    expect(parseStudioBackup('lorebooks', JSON.stringify(good)).ok).toBe(true)
    const bad = { ...good, books: [{ ...good.books[0], entries: [{ uid: 'e1', keys: [], text: 't', enabled: true }] }] }
    expect(parseStudioBackup('lorebooks', JSON.stringify(bad)).ok).toBe(false)
  })
})

describe('the kind marker', () => {
  it('refuses a file of another section, naming what it is', () => {
    const file = buildLorebooksBackup({ schemaVersion: 1, on: [] }, [])
    const result = parseStudioBackup('presets', JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: 'This is a lorebooks backup, not a presets backup.' })
  })

  it('refuses a file that is no backup at all', () => {
    expect(parseStudioBackup('prompts', '{"a":1}').ok).toBe(false)
    expect(parseStudioBackup('prompts', 'nope').ok).toBe(false)
  })
})
