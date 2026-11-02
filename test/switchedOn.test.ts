import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.restoreAllMocks())

it('waits for boot readers, tells each enabled mod once, and tells it again after off/on', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const on = new Set(['reader'])
  let notify = () => {}
  hooks.setHookRules({ isOn: id => on.has(id), order: () => 0, subscribe: fn => { notify = fn; return () => {} } })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const reader = vi.fn(async () => gate)
  hooks.registerHooks('reader', { switchedOn: reader })
  let ready = false
  const boot = hooks.startSwitchedOn().then(() => { ready = true })
  expect(reader).toHaveBeenCalledExactlyOnceWith({ atBoot: true })
  expect(ready).toBe(false)
  release()
  await boot
  expect(ready).toBe(true)
  notify()
  expect(reader).toHaveBeenCalledTimes(1)
  on.clear()
  notify()
  on.add('reader')
  notify()
  expect(reader).toHaveBeenCalledTimes(2)
  expect(reader).toHaveBeenLastCalledWith({ atBoot: false })
})

it('isolates a failed reader so other mods and boot still complete', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: () => true, order: () => 0 })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const other = vi.fn()
  hooks.registerHooks('broken', { switchedOn: async () => { throw Error('fixture') } })
  hooks.registerHooks('working', { switchedOn: other })
  await expect(hooks.startSwitchedOn()).resolves.toBeUndefined()
  expect(other).toHaveBeenCalledExactlyOnceWith({ atBoot: true })
  expect(warn).toHaveBeenCalledWith('[mods] broken: switchedOn failed', expect.any(Error))
})
