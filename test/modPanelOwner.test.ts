import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The game view closes a mod's open panel once no mod that is on draws it, so `blocked` cannot
 * stay up for a mod that went off. Reported by naudh1r on #136.
 */

type Hooks = typeof import('../src/renderer/mods/hooks')
type Owner = typeof import('../src/renderer/views/modPanelOwner')

const Panel = (): null => null

describe('a mod panel whose mod goes off', () => {
  let hooks: Hooks
  let owner: Owner
  const on: Record<string, boolean> = {}

  beforeEach(async () => {
    vi.resetModules()
    hooks = await import('../src/renderer/mods/hooks')
    owner = await import('../src/renderer/views/modPanelOwner')
    for (const id of Object.keys(on)) delete on[id]
    hooks.setHookRules({ isOn: (id) => on[id] ?? true, order: () => 0 })
  })

  it('is gone once the gameModal id has no panel from a mod that is on', () => {
    hooks.registerHooks('notes', { gameModals: { journal: Panel } })
    const panel = { kind: 'gameModal', id: 'journal' } as const
    expect(owner.modPanelGone(panel)).toBe(false)

    on.notes = false
    expect(owner.modPanelGone(panel)).toBe(true)
  })

  it('stays while another mod that is on still has a panel under the id', () => {
    hooks.registerHooks('notes', { gameModals: { journal: Panel } })
    hooks.registerHooks('diary', { gameModals: { journal: Panel } })
    on.notes = false
    expect(owner.modPanelGone({ kind: 'gameModal', id: 'journal' })).toBe(false)
  })

  it("is gone once the modPanel's mod is no longer in scenePlays()", () => {
    hooks.registerHooks('reckoning', { scenePlay: { Seat: Panel, Panel } })
    hooks.registerHooks('other', { scenePlay: { Seat: Panel, Panel } })
    const panel = { kind: 'modPanel', modId: 'reckoning' } as const
    expect(owner.modPanelGone(panel)).toBe(false)

    on.reckoning = false
    expect(hooks.scenePlays().map(({ modId }) => modId)).toEqual(['other'])
    expect(owner.modPanelGone(panel)).toBe(true)
  })
})
