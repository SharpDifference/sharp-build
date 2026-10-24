import { describe, expect, it } from 'vitest'
import {
  applyImport,
  emptyLorebook,
  normalizedLorebook,
  parseWorldInfo,
  parseWorldInfoText,
  readLorebookRecord,
  withCustomEntry,
  withShippedEdit,
  withSetting,
  worldInfoOf,
  type LorebookRecord,
  type ShippedBook
} from '@shared/lorebookRecord'

/**
 * A playthrough's own lorebook: only what the player changed of a shipped entry or the setting
 * is kept, so whatever he never touched follows the build — on disk and through a SillyTavern
 * file alike.
 */

/** The code a refusal carries, or undefined where nothing was refused. */
function refusalOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (err) {
    return (err as { code?: string }).code
  }
  return undefined
}

/**
 * A build's shipped entries and setting, made up; `text` and `setting` let a later build rewrite
 * the first entry and the setting.
 */
function shippedBook(text = 'A library.', setting = 'A small city.'): ShippedBook {
  return {
    entries: [
      { ref: 'library', keys: ['Library', 'books'], text },
      { ref: 'cafe', keys: ['Cafe'], text: 'A cafe.' }
    ],
    setting
  }
}

/** A file's text after a round trip through JSON, as an import reads it. */
function throughFile(record: LorebookRecord, shipped: ShippedBook): string {
  return JSON.stringify(worldInfoOf(record, shipped))
}

describe('an edit of a shipped entry', () => {
  it('keeps only the field that differs from the build, and nothing once both match', () => {
    const [library] = shippedBook().entries
    const edited = withShippedEdit(emptyLorebook(), library, {
      keys: ['Library', 'books'],
      text: 'A haunted library.'
    })
    expect(edited.edits).toEqual({ library: { text: 'A haunted library.' } })

    const back = withShippedEdit(edited, library, { text: 'A library.' })
    expect(back.edits).toEqual({})
  })

  it('drops an entry the build no longer ships and a field the build now ships as written', () => {
    const record: LorebookRecord = {
      ...emptyLorebook(),
      edits: {
        library: { keys: ['Stacks'], text: 'A haunted library.' },
        gone: { text: 'Somewhere that was cut.' }
      },
      setting: 'A big city.'
    }
    const read = normalizedLorebook(record, shippedBook('A haunted library.', 'A big city.'))
    expect(read).toEqual({ ...emptyLorebook(), edits: { library: { keys: ['Stacks'] } } })
  })
})

describe('the setting', () => {
  it('is kept only while it differs from the build', () => {
    const { setting } = shippedBook()
    const edited = withSetting(emptyLorebook(), '  A walled city.\r\n', setting)
    expect(edited.setting).toBe('A walled city.')
    expect(withSetting(edited, setting, setting)).toEqual(emptyLorebook())
  })
})

describe('the kept record', () => {
  it('refuses a blank trigger word, a repeated id and another version', () => {
    const valid = withCustomEntry(emptyLorebook(), { keys: ['Night market'], text: 'Stalls.' })
    expect(readLorebookRecord(JSON.parse(JSON.stringify(valid.record)), 'x')).toEqual(valid.record)

    const blank = { ...emptyLorebook(), custom: [{ id: 'custom1', keys: [' '], text: 'Stalls.' }] }
    expect(refusalOf(() => readLorebookRecord(blank, 'x'))).toBe('LOREBOOK_MALFORMED')

    const twice = { ...valid.record, custom: [...valid.record.custom, ...valid.record.custom] }
    expect(refusalOf(() => readLorebookRecord(twice, 'x'))).toBe('LOREBOOK_MALFORMED')

    expect(refusalOf(() => readLorebookRecord({ ...valid.record, schemaVersion: 9 }, 'x'))).toBe(
      'LOREBOOK_SCHEMA_VERSION'
    )

    const set = { ...valid.record, setting: 'A walled city.' }
    expect(readLorebookRecord(JSON.parse(JSON.stringify(set)), 'x')).toEqual(set)
    const unset = { ...valid.record, setting: '  ' }
    expect(refusalOf(() => readLorebookRecord(unset, 'x'))).toBe('LOREBOOK_MALFORMED')
  })
})

describe('a SillyTavern lorebook', () => {
  it('replaces the lorebook with exactly what was exported', () => {
    const shipped = shippedBook()
    let record = withShippedEdit(emptyLorebook(), shipped.entries[0], {
      text: 'A haunted library.'
    })
    record = withShippedEdit(record, shipped.entries[1], { keys: ['Cafe', 'coffee'] })
    record = withCustomEntry(record, { keys: ['Night market'], text: 'Stalls.', bg: 'market' })
      .record
    record = withSetting(record, 'A walled city.', shipped.setting)

    const read = parseWorldInfoText(throughFile(record, shipped))
    const applied = applyImport(emptyLorebook(), read, shipped, true)
    expect(applied.record).toEqual(record)
    expect(applied).toMatchObject({ imported: 4, leftOut: 0 })
  })

  it('lets an untouched entry and setting follow a later build and keeps an edit across it', () => {
    const before = shippedBook('A library.', 'A small city.')
    const record = withShippedEdit(emptyLorebook(), before.entries[1], { text: 'A cat cafe.' })
    const file = throughFile(record, before)

    const after = shippedBook('A library with a rooftop.', 'A small city by a river.')
    const applied = applyImport(emptyLorebook(), parseWorldInfoText(file), after, true)
    expect(applied.record).toEqual({ ...emptyLorebook(), edits: { cafe: { text: 'A cat cafe.' } } })
  })

  it('counts a field or a setting changed in the file itself as an edit', () => {
    const shipped = shippedBook()
    const world = worldInfoOf(emptyLorebook(), shipped)
    world.entries['0'].content = 'A city, rewritten in SillyTavern.'
    world.entries['1'].content = 'A library, rewritten in SillyTavern.'
    const applied = applyImport(emptyLorebook(), parseWorldInfo(world), shipped, true)
    expect(applied.record.edits).toEqual({
      library: { text: 'A library, rewritten in SillyTavern.' }
    })
    expect(applied.record.setting).toBe('A city, rewritten in SillyTavern.')
  })

  it('adds only its own entries after the player\'s, ignoring its edits of shipped ones', () => {
    const shipped = shippedBook()
    let mine = withCustomEntry(emptyLorebook(), { keys: ['Pier'], text: 'A pier.' }).record
    mine = withSetting(mine, 'My city.', shipped.setting)
    let theirs = withShippedEdit(emptyLorebook(), shipped.entries[0], { text: 'Their library.' })
    theirs = withCustomEntry(theirs, { keys: ['Night market'], text: 'Stalls.' }).record
    theirs = withSetting(theirs, 'Their city.', shipped.setting)

    const applied = applyImport(mine, parseWorldInfoText(throughFile(theirs, shipped)), shipped, false)
    expect(applied.record.edits).toEqual({})
    expect(applied.record.setting).toBe('My city.')
    expect(applied).toMatchObject({ imported: 1, leftOut: 0 })
    expect(applied.record.custom.map((entry) => [entry.id, entry.keys[0]])).toEqual([
      ['custom1', 'Pier'],
      ['custom2', 'Night market']
    ])
  })

  it('leaves out what the game cannot use, and refuses a file with nothing it can', () => {
    const plain = {
      entries: {
        '0': { key: ['dragon'], content: 'Dragons nest in the hills.' },
        '1': { key: ['ghost'], content: 'A ghost.', disable: true },
        '2': { key: ['/drag(on|ons)/i'], content: 'Only a regular expression keys this.' },
        '3': { key: ['empty'], content: '   ' }
      }
    }
    const applied = applyImport(emptyLorebook(), parseWorldInfo(plain), shippedBook(), false)
    expect(applied.record.custom.map((entry) => entry.keys)).toEqual([['dragon']])
    expect(applied.leftOut).toBe(3)

    const set = withSetting(emptyLorebook(), 'My city.', shippedBook().setting)
    expect(applyImport(set, parseWorldInfo(plain), shippedBook(), true).record.setting).toBe(
      undefined
    )

    const nothing = { entries: { '0': { key: ['ghost'], content: 'A ghost.', disable: true } } }
    expect(
      refusalOf(() => applyImport(emptyLorebook(), parseWorldInfo(nothing), shippedBook(), true))
    ).toBe('LOREBOOK_IMPORT_EMPTY')
    expect(refusalOf(() => parseWorldInfoText('not json'))).toBe('LOREBOOK_IMPORT_INVALID')
  })
})
