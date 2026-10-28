import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameSave } from '@shared/types'
import { playthroughRecord, stubApi } from './fixtures'

/**
 * A mod's unsaved state: `game` state back at its start as a game is entered or left, `session`
 * state kept through both, and one state per mod id.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const host = await import('@vx/modkit/host/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')

afterEach(() => {
  host.setDeclaredHooks(null)
  host.setLoadingMod(null)
  vi.restoreAllMocks()
})

function enterGame(): void {
  useGameStore.getState().reset()
  const save = { ...useGameStore.getState().toGameSave(), playthroughId: 'p1', saveId: 'manual01', saveDate: 0 } as GameSave
  useGameStore.getState().loadSave(save, playthroughRecord(), {})
}

describe('modState', () => {
  const perGame = kit.modState('game-state-mod', { initial: 0, lifetime: 'game' })
  const perSession = kit.modState('session-state-mod', { initial: 'start', lifetime: 'session' })

  it('puts game state back at its start as a game is entered and as it is left, and keeps session state', () => {
    const seen: number[] = []
    const unsubscribe = perGame.subscribe((value) => seen.push(value))

    perGame.set(3)
    perSession.set('kept')
    enterGame()
    expect(perGame.get()).toBe(0)

    perGame.set(5)
    useGameStore.getState().reset()
    expect(perGame.get()).toBe(0)
    expect(perSession.get()).toBe('kept')
    expect(seen).toEqual([3, 0, 5, 0])
    unsubscribe()
  })

  it('refuses a second state for one id, and one for another id during an installed mod’s import', () => {
    const refused: [string, string][] = []
    host.setDeclaredHooks({
      declared: (id) => (id === 'installed-mod' ? [] : undefined),
      onRefused: (id, message) => refused.push([id, message])
    })
    kit.modState('installed-mod', { initial: 1, lifetime: 'session' })
    const second = kit.modState('installed-mod', { initial: 2, lifetime: 'session' })
    second.set(9)
    expect(second.get()).toBe(2)

    host.setLoadingMod('installed-mod')
    const foreign = kit.modState('victim-mod', { initial: 'v', lifetime: 'game' })
    host.setLoadingMod(null)
    foreign.set('mine')
    expect(foreign.get()).toBe('v')
    // The refused id is still free for its own mod.
    expect(kit.modState('victim-mod', { initial: 'theirs', lifetime: 'game' }).get()).toBe('theirs')

    expect(refused).toEqual([
      ['installed-mod', 'registered a second mod state for `installed-mod`'],
      ['installed-mod', 'registered a mod state for `victim-mod`, which is another mod']
    ])
    // An in-repo mod's second state is a bug in the build.
    kit.modState('in-repo-mod', { initial: 0, lifetime: 'game' })
    expect(() => kit.modState('in-repo-mod', { initial: 0, lifetime: 'game' })).toThrow('second mod state')
  })
})
