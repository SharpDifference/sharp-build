import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `registerHooks` holding an installed mod's registration to its manifest: a mod with no
 * manifest registers as before, a declared registration is asked, an undeclared one is not kept
 * and the refusal is reported, and a registration under another mod's id during an import is
 * refused too.
 */

type Hooks = typeof import('../../src/renderer/mods/hooks')
type Host = typeof import('@vx/modkit/host/renderer')

let hooks: Hooks
let host: Host
let refused: [string, string][]

beforeEach(async () => {
  vi.resetModules()
  hooks = await import('../../src/renderer/mods/hooks')
  host = await import('@vx/modkit/host/renderer')
  hooks.setHookRules({ isOn: () => true, order: (id) => ['in-repo', 'declared', 'sloppy'].indexOf(id) })
  refused = []
  host.setDeclaredHooks({
    declared: (id) => ({ declared: ['prompts.dm', 'renderer:registerHooks'], sloppy: ['prompts.dm'] })[id],
    onRefused: (id, message) => refused.push([id, message])
  })
})

const ctx = {} as import('../../src/renderer/mods/hooks').PromptSpots['dm']

describe('registerHooks with the declared lists', () => {
  it('registers a mod with no manifest as before', () => {
    hooks.registerHooks('in-repo', { prompts: { dm: { lines: () => ['in-repo'] } }, postVisible: () => true })
    expect(hooks.promptLines('dm', ctx)).toEqual(['in-repo'])
    expect(refused).toEqual([])
  })

  it('registers what the manifest declares', () => {
    hooks.registerHooks('declared', { prompts: { dm: { lines: () => ['declared'] } } })
    expect(hooks.promptLines('dm', ctx)).toEqual(['declared'])
    expect(refused).toEqual([])
  })

  it('keeps nothing of a registration naming a hook the manifest does not declare, and says so', () => {
    hooks.registerHooks('sloppy', { prompts: { dm: { lines: () => ['sloppy'] } }, gameEntered: () => {} })
    expect(hooks.promptLines('dm', ctx)).toEqual([])
    expect(refused).toEqual([['sloppy', 'registers `gameEntered` but does not declare it: the build and the manifest disagree']])
  })

  it("refuses a registration under another mod's id while a mod is being imported", () => {
    host.setLoadingMod('declared')
    hooks.registerHooks('sloppy', { prompts: { dm: { lines: () => ['sloppy'] } } })
    host.setLoadingMod(null)
    expect(hooks.promptLines('dm', ctx)).toEqual([])
    expect(refused).toEqual([['declared', 'registered hooks for `sloppy`, which is another mod']])
  })

  it('registers as before once the lists are taken away', () => {
    host.setDeclaredHooks(null)
    hooks.registerHooks('sloppy', { gameEntered: () => {} })
    expect(refused).toEqual([])
  })
})
