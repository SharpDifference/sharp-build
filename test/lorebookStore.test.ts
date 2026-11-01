import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Result } from '@shared/types'
import { restoreApi, stubApi } from './fixtures'

stubApi({})
const { useLorebookStore, lorebookSettled } = await import('../src/renderer/stores/lorebookStore')

/**
 * Where the lorebook's writes land while the player types: each playthrough's lorebook gets the
 * newest of its own edits, and never another playthrough's.
 */

/** A write held open until the test lets it go. */
let releaseFirst: () => void = () => {}
let write = vi.fn()

beforeEach(() => {
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  let calls = 0
  write = vi.fn(async (): Promise<Result<void>> => {
    calls += 1
    if (calls === 1) await first
    return { ok: true, data: undefined }
  })
  stubApi({ lorebook: { read: async () => ({ ok: true, data: null }), write } })
})

afterEach(() => {
  useLorebookStore.getState().drop()
  restoreApi()
})

/** Rewrites the setting under the editor's current revision. */
function type(text: string): void {
  const store = useLorebookStore.getState()
  expect(store.editSetting(text, store.revision)).toBe(true)
}

/** The playthrough and setting of each write, in the order they were made. */
function written(): [string, string | undefined][] {
  return write.mock.calls.map(([id, record]) => [id, record.setting])
}

describe('lorebook writes', () => {
  it('writes only the newest edit made behind a write in flight', async () => {
    await useLorebookStore.getState().load('one')
    type('A')
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    type('AB')
    type('ABC')
    releaseFirst()
    await lorebookSettled()
    expect(written()).toEqual([
      ['one', 'A'],
      ['one', 'ABC']
    ])
  })

  it('never folds an edit waiting for one playthrough into the next', async () => {
    await useLorebookStore.getState().load('one')
    type('A')
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    type('AB')
    useLorebookStore.getState().drop()
    useLorebookStore.getState().beginNewGame(async () => 'fresh')
    type('C')
    releaseFirst()
    await lorebookSettled()
    expect(written()).toEqual([
      ['one', 'A'],
      ['one', 'AB'],
      ['fresh', 'C']
    ])
  })
})
