import { useSyncExternalStore } from 'react'
import { declaredHooksNow, refusedAsForeign } from './attribution'

/**
 * A mod's own state in the window that is never saved: not in a save, not in a backup. `game`
 * state goes back to its `initial` whenever a game is entered or left; `session` state lasts
 * until the window closes.
 */

/** How a mod's unsaved state starts, and how long it lasts. */
export interface ModStateSpec<T> {
  /** The value it starts at, and goes back to. */
  initial: T
  /** `game`: back to `initial` as a game is entered or left. `session`: kept until the window closes. */
  lifetime: 'game' | 'session'
}

/** A mod's unsaved state, from {@link modState}. */
export interface ModStateHandle<T> {
  /** The value now. */
  get(): T
  /** Replaces the value, telling every subscriber. */
  set(next: T): void
  /** The value, for a component: it renders again when the value changes. */
  use(): T
  /** Calls back with the value each time it changes; returns the unsubscribe. */
  subscribe(onChange: (value: T) => void): () => void
}

/** One mod's state, as the boundary sees it. */
interface Entry {
  lifetime: 'game' | 'session'
  restart: () => void
}

const states = new Map<string, Entry>()

let unsubscribeBoundary: (() => void) | null = null

/**
 * Hands the states core's signal for a game entered or left: `subscribe` calls back on each one.
 * Null takes it away again.
 */
export function bindGameBoundary(subscribe: ((onBoundary: () => void) => () => void) | null): void {
  unsubscribeBoundary?.()
  unsubscribeBoundary = subscribe
    ? subscribe(() => {
        for (const entry of states.values()) if (entry.lifetime === 'game') entry.restart()
      })
    : null
}

/** A handle for a refused registration: it holds `initial` and changes nothing. */
function inertState<T>(initial: T): ModStateHandle<T> {
  return { get: () => initial, set: () => {}, use: () => initial, subscribe: () => () => {} }
}

/**
 * A mod's unsaved state, registered once from its own files. During an installed mod's import, a
 * state under another id is refused, as is a second state under one id (which throws for an
 * in-repo mod, whose bug it is); a refused state holds `initial` and changes nothing.
 */
export function modState<T>(modId: string, spec: ModStateSpec<T>): ModStateHandle<T> {
  if (refusedAsForeign(modId, 'a mod state')) return inertState(spec.initial)
  if (states.has(modId)) {
    const message = `registered a second mod state for \`${modId}\``
    const declared = declaredHooksNow()
    if (!declared?.declared(modId)) throw new Error(`[mods] ${modId}: ${message}`)
    declared.onRefused(modId, message)
    return inertState(spec.initial)
  }

  let value = spec.initial
  const watchers = new Set<(value: T) => void>()
  const set = (next: T): void => {
    if (Object.is(next, value)) return
    value = next
    for (const watcher of [...watchers]) watcher(value)
  }
  states.set(modId, { lifetime: spec.lifetime, restart: () => set(spec.initial) })

  const get = (): T => value
  const subscribe = (onChange: (value: T) => void): (() => void) => {
    watchers.add(onChange)
    return () => {
      watchers.delete(onChange)
    }
  }
  return { get, set, use: () => useSyncExternalStore(subscribe, get, get), subscribe }
}
