import { afterEach, expect, it, vi } from 'vitest'
import type { CharInfo, EnrollmentDraft, SaveDraft } from '@shared/types'
import { validateRecord, type ValidateRecordOptions } from '@shared/jsonValidate'
import { ENROLLMENT_READ, SAVE_READ, stampEnrollment, stampSave } from '@shared/saveRules'
import { modOn, type ModDef, type ModSwitches } from '@shared/mods'
import { setSharedModRules, sharedModOn } from '@shared/modRules'
import type { SlotMemoryProjection } from '../src/renderer/mods/hooks'

// A mod contributes its schema from its own module, without changing shared/types.ts.
declare module '@shared/types' {
  interface GameSave { extensionFixture?: { points: number } }
  interface ModEnrollmentFields { extensionFixture?: { points: number } }
}

afterEach(() => setSharedModRules(() => false))

it('projects in mod order before settlement, skips disabled handlers and leaves inputs intact', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: id => id !== 'off', order: id => ['first', 'second', 'off'].indexOf(id) })
  const ctx = { before: {}, closingCast: [] } as unknown as SlotMemoryProjection
  const original: Record<string, CharInfo> = { girl: { flags: {}, memories: [] } as unknown as CharInfo }
  const settled = vi.fn()
  const disabled = vi.fn(() => { throw Error('disabled projection ran') })
  hooks.registerHooks('second', {
    projectSlotMemories: (received, info) => {
      expect(received).toBe(ctx)
      expect(info.girl.memories).toHaveLength(1)
      return { ...info, girl: { ...info.girl, memories: info.girl.memories.map(m => ({ ...m, desc: 'weighted' })) } }
    },
    slotSettled: settled
  })
  hooks.registerHooks('first', {
    projectSlotMemories: (_, info) => ({ ...info, girl: { ...info.girl, memories: [{ type: 'liked', date: 1, desc: 'new' }] } })
  })
  hooks.registerHooks('off', { projectSlotMemories: disabled })
  expect(hooks.projectSlotMemories(ctx, original).girl.memories[0].desc).toBe('weighted')
  expect(original.girl.memories).toEqual([])
  expect(settled).not.toHaveBeenCalled()
  expect(disabled).not.toHaveBeenCalled()
  hooks.setHookRules({ isOn: () => false, order: () => 0 })
  expect(hooks.projectSlotMemories(ctx, original)).toBe(original)
})

it('keeps the native Lorebook tab reserved', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: () => true, order: () => 0 })
  hooks.registerHooks('collision', { bunnyboardPage: { id: 'lorebook', word: 'other', Mark: () => null, Page: () => null } })
  expect(hooks.bunnyboardPages()).toEqual([])
})

it('reads live switch and playthrough rules in shared code without retaining stale choices', () => {
  expect(sharedModOn('example')).toBe(false)
  const defs: ModDef[] = [
    { id: 'session', name: 'Session', author: '', version: '1', scope: 'playthrough', defaultOn: false, blurb: '' },
    { id: 'live', name: 'Live', author: '', version: '1', scope: 'anytime', defaultOn: false, blurb: '' }
  ]
  let switches: ModSwitches = { on: {}, options: {} }
  let record: { mods: string[] } | null = null
  setSharedModRules(id => modOn(switches, id, record, defs))
  expect(sharedModOn('live')).toBe(false)
  switches = { on: { live: true, session: true }, options: {} }
  expect(sharedModOn('live')).toBe(true)
  expect(sharedModOn('session')).toBe(true)
  record = { mods: [] }
  expect(sharedModOn('session')).toBe(false)
  record = { mods: ['session'] }
  switches = { on: {}, options: {} }
  expect(sharedModOn('session')).toBe(true)
  expect(sharedModOn('live')).toBe(false)
})

it('preserves optional mod fields while still requiring native save and enrollment fields', () => {
  function check<T extends object>(opts: ValidateRecordOptions<T>): void {
    // This validator checks presence; create every native required key, including schema.
    const native: Record<string, unknown> = { ...Object.fromEntries(Object.keys(opts.required).map(k => [k, null])), schemaVersion: opts.expects }
    expect(validateRecord(native, 'fixture', opts)).toEqual(native)
    const withMod = { ...native, extensionFixture: { points: 42 } }
    expect(validateRecord(withMod, 'fixture', opts)).toEqual(withMod)
    const { stats: _, ...missingNative } = native
    expect(() => validateRecord(missingNative, 'fixture', opts)).toThrow(/missing "stats"/)
  }
  check(SAVE_READ)
  check(ENROLLMENT_READ)
  const extra = { extensionFixture: { points: 42 } }
  expect(stampSave(extra as SaveDraft, '1', 'autosave', 1).extensionFixture).toEqual(extra.extensionFixture)
  expect(stampEnrollment(extra as EnrollmentDraft, 1).extensionFixture).toEqual(extra.extensionFixture)
})
