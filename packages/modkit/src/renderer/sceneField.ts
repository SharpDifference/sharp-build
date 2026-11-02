import { useSyncExternalStore } from 'react'
import { declaredHooksNow, refusedAsForeign } from './attribution'

/**
 * A mod's own plain-JSON data for the scene being played. It is saved with the scene and restored
 * with it, and is gone once the next scene is cast. Core never reads inside a mod's value.
 */

/** What a mod keeps with the scene: the value while it holds nothing. */
export interface SceneFieldSpec<T> {
  empty: T
}

/** A mod's value for the scene being played, from {@link sceneField}. */
export interface SceneFieldHandle<T> {
  /** The value now, or `empty`. */
  read(): T
  /** The value now, for a component: it renders again when the value changes. */
  use(): T
  /** Replaces this mod's value, and no other mod's; it goes out with the next save of the scene. */
  set(next: T): void
}

/** Where the scene's values are kept: core's game store, bound at its load. */
export interface SceneFieldStore {
  /** The value of each mod that has one in this scene, by id. */
  values: () => Readonly<Record<string, unknown>>
  set: (modId: string, value: unknown) => void
  subscribe: (onChange: () => void) => () => void
}

const registered = new Set<string>()

let store: SceneFieldStore | null = null

/** Hands the handles the game store; null takes it away again. */
export function bindSceneFieldStore(next: SceneFieldStore | null): void {
  store = next
}

/** A handle for a refused registration: it reads `empty` and writes nothing. */
function inertHandle<T>(empty: T): SceneFieldHandle<T> {
  return { read: () => empty, use: () => empty, set: () => {} }
}

/**
 * A mod's data for the current scene, registered once from its own files. During an installed
 * mod's import, a field under another id is refused, as is a second field under one id (which
 * throws for an in-repo mod, whose bug it is); a refused field reads `empty` and writes nothing.
 */
export function sceneField<T>(modId: string, spec: SceneFieldSpec<T>): SceneFieldHandle<T> {
  if (refusedAsForeign(modId, 'a scene field')) return inertHandle(spec.empty)
  if (registered.has(modId)) {
    const message = `registered a second scene field for \`${modId}\``
    const declared = declaredHooksNow()
    if (!declared?.declared(modId)) throw new Error(`[mods] ${modId}: ${message}`)
    declared.onRefused(modId, message)
    return inertHandle(spec.empty)
  }
  registered.add(modId)

  const read = (): T => {
    const values = store?.values()
    return values && Object.hasOwn(values, modId) ? (values[modId] as T) : spec.empty
  }
  const subscribe = (onChange: () => void): (() => void) => store?.subscribe(onChange) ?? (() => {})
  return {
    read,
    use: () => useSyncExternalStore(subscribe, read, read),
    set: (next) => {
      if (!store) throw new Error(`[mods] ${modId}: its scene field was set before the game store was loaded`)
      store.set(modId, structuredClone(next))
    }
  }
}
