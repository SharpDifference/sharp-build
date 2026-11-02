import { useSyncExternalStore } from 'react'
import type { Result } from '../bridge/shared'
import { MOD_ID_RULE } from '../shared/manifest'
import { declaredHooksNow, refusedAsForeign } from './attribution'

/**
 * A mod's own plain-JSON data for the scene being played. It is saved with the scene and restored
 * with it, and is gone once the next scene is cast. Core never reads inside a mod's value.
 */

/** What a mod keeps with the scene: the value while it holds nothing. */
export interface SceneFieldSpec<T> {
  empty: T
  /**
   * The key the mod kept its scene data under before it had a field, read where the mod's own is
   * absent; the next `set` or `save` moves the value to the mod's id. It must not be a valid mod
   * id, so it can never be another mod's, and only one field may claim it.
   */
  legacy?: string
  /**
   * Makes a stored value the mod's own, as a load brings it back from a save an older version of
   * the mod may have written. Handed a copy; pure. A throw reads as `empty`, with a warning naming
   * the mod, and leaves the stored value as it was until the next `set`. A value the mod set itself
   * is read back as set.
   */
  normalize?: (stored: unknown) => T
}

/** A mod's value for the scene being played, from {@link sceneField}. */
export interface SceneFieldHandle<T> {
  /** The value now, or `empty`. */
  read(): T
  /** The value now, for a component: it renders again when the value changes. */
  use(): T
  /** Replaces this mod's value, and no other mod's; it goes out with the next save of the scene. */
  set(next: T): void
  /**
   * `set`, then the value written into the save a reload lands on: the reader's last turn in this
   * scene, or the scene as it stands before its first. Other mods' values there stay as they were.
   * A refusal changes nothing and comes back as the result's error, never as a throw:
   * `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` (no playthrough, as in a replay or a created scene),
   * `MOD_WRITE_NO_SCENE` (no scene, or its ending being written), `MOD_WRITE_STALE` (the game was
   * left before the write's turn), or the disk's own error.
   */
  save(next: T): Promise<Result<null>>
}

/** Where the scene's values are kept: core's game store, bound at its load. */
export interface SceneFieldStore {
  /** The value of each mod that has one in this scene, by key, each kept as it was handed over. */
  values: () => Readonly<Record<string, unknown>>
  /** Sets each key to its value; undefined takes the key out. */
  set: (changes: Readonly<Record<string, unknown>>) => void
  subscribe: (onChange: () => void) => () => void
}

/** Where a field's `save` goes: core's saves, bound at their load. */
export interface SceneFieldSaves {
  /**
   * Once the mod may save, `apply` puts its value on the store, and `keys` (the field's own keys
   * in the scene's mods) are written into the save a reload lands on.
   */
  save: (modId: string, keys: readonly string[], apply: () => void) => Promise<Result<null>>
}

const registered = new Set<string>()

/** Every legacy key a field has claimed, and the mod that claimed it. */
const legacyClaims = new Map<string, string>()

let store: SceneFieldStore | null = null

let saves: SceneFieldSaves | null = null

/** Hands the handles the game store; null takes it away again. */
export function bindSceneFieldStore(next: SceneFieldStore | null): void {
  store = next
}

/** Hands the handles core's saves; null takes them away again. */
export function bindSceneFieldSaves(next: SceneFieldSaves | null): void {
  saves = next
}

function failed(code: string, message: string): Result<null> {
  return { ok: false, error: { code, message } }
}

/** A handle for a refused registration: it reads `empty` and writes nothing. */
function inertHandle<T>(empty: T): SceneFieldHandle<T> {
  const save = async (): Promise<Result<null>> => failed('MOD_WRITE_FOREIGN', 'That scene field was refused.')
  return { read: () => empty, use: () => empty, set: () => {}, save }
}

/** Refuses a registration: an in-repo mod's is its bug and throws; an installed mod is told. */
function refuse<T>(modId: string, message: string, empty: T): SceneFieldHandle<T> {
  const declared = declaredHooksNow()
  if (!declared?.declared(modId)) throw new Error(`[mods] ${modId}: ${message}`)
  declared.onRefused(modId, message)
  return inertHandle(empty)
}

/** Why `legacy` cannot be claimed by `modId`, or null where it can. */
function legacyRefusal(modId: string, legacy: unknown): string | null {
  if (typeof legacy !== 'string' || legacy === '') return 'gave its scene field a legacy key that is not a name'
  if (MOD_ID_RULE.test(legacy)) return `gave its scene field the legacy key \`${legacy}\`, which could be a mod's id`
  const owner = legacyClaims.get(legacy)
  if (owner !== undefined && owner !== modId) return `gave its scene field the legacy key \`${legacy}\`, which \`${owner}\` claimed`
  return null
}

/**
 * A mod's data for the current scene, registered once from its own files. During an installed
 * mod's import, a field under another id is refused, as is a second field under one id, or a
 * legacy key that could be a mod's id or that another field claimed (each of which throws for an
 * in-repo mod, whose bug it is); a refused field reads `empty` and writes nothing.
 */
export function sceneField<T>(modId: string, spec: SceneFieldSpec<T>): SceneFieldHandle<T> {
  if (refusedAsForeign(modId, 'a scene field')) return inertHandle(spec.empty)
  if (registered.has(modId)) return refuse(modId, `registered a second scene field for \`${modId}\``, spec.empty)
  const { legacy } = spec
  if (legacy !== undefined) {
    const refusal = legacyRefusal(modId, legacy)
    if (refusal) return refuse(modId, refusal, spec.empty)
    legacyClaims.set(legacy, modId)
  }
  registered.add(modId)
  const keys = legacy === undefined ? [modId] : [modId, legacy]

  /** The value as stored: under the mod's id, else under its legacy key. */
  const stored = (): unknown => {
    const values = store?.values()
    if (!values) return undefined
    if (Object.hasOwn(values, modId)) return values[modId]
    return legacy !== undefined && Object.hasOwn(values, legacy) ? values[legacy] : undefined
  }
  // The last stored value read, and what it was read as, so `use` sees one value until it moves.
  let seen: { stored: unknown; value: T } | null = null

  const read = (): T => {
    const value = stored()
    if (value === undefined) return spec.empty
    if (!spec.normalize) return value as T
    if (seen && seen.stored === value) return seen.value
    let next: T
    try {
      next = spec.normalize(structuredClone(value))
    } catch (err) {
      console.warn(`[mods] ${modId}: its scene value could not be read, so it reads as empty`, err)
      next = spec.empty
    }
    seen = { stored: value, value: next }
    return next
  }
  /** Puts a copy the mod no longer holds on the store, in place of any legacy value. */
  const place = (copy: T): void => {
    if (!store) throw new Error(`[mods] ${modId}: its scene field was set before the game store was loaded`)
    store.set(legacy === undefined ? { [modId]: copy } : { [modId]: copy, [legacy]: undefined })
    seen = { stored: copy, value: copy }
  }
  const subscribe = (onChange: () => void): (() => void) => store?.subscribe(onChange) ?? (() => {})
  return {
    read,
    use: () => useSyncExternalStore(subscribe, read, read),
    set: (next) => place(structuredClone(next)),
    save: async (next) => {
      if (!store || !saves) return failed('MOD_WRITE_NO_GAME', 'There is no game to save into.')
      const copy = structuredClone(next)
      return saves.save(modId, keys, () => place(copy))
    }
  }
}
