import { useSyncExternalStore } from 'react'
import { modById, type ModSlice } from '../bridge/shared'
import type { TermCarryContext } from '../shared/modCarry'
import { declaredHooksNow, refusedAsForeign } from './attribution'

/**
 * A mod's own data in a save, kept under the mod's id in the save's `ex`, and on the records
 * inside it. Core never reads inside a slice: it writes each one back as read, and only the mod
 * that registered the field turns it into a value. Every value is plain JSON.
 */

/** A record that can carry mods' slices: the save, a character, a memory, a message, a post. */
export interface ModDataRecord {
  /** The mods' slices on the record, by mod id. */
  ex?: Record<string, ModSlice>
}

/** What a mod keeps in the save: its value's empty state, how it is read, and what the next semester gets. */
export interface SaveFieldSpec<T> {
  /** The value while the save holds nothing for the mod. */
  empty: T
  /**
   * The mod's own old top-level save keys, read once into `normalize` and then removed. Without
   * a `normalize` to read them they are left in the save as they are.
   */
  legacy?: readonly string[]
  /**
   * The mod's value from what the save holds: `stored` is its slice's data as read (undefined
   * where none), `legacy` the old keys as read, `from` the mod version that wrote the slice, or
   * null for a legacy or pre-kit one. Pure; a throw leaves the save's data as it was and the mod
   * at `empty` for this game. Without it, the value is the stored data, or `empty`.
   */
  normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T
  /** What the next semester starts with, given this one's value; undefined, or no `carry`, starts it empty. */
  carry?: (value: T, context: TermCarryContext) => T | undefined
}

/** A mod's live value in the game being played, from {@link saveField}. */
export interface SaveFieldHandle<T> {
  /** The live value, or `empty`. */
  read(): T
  /** The live value, for a component: it renders again when the value changes. */
  use(): T
  /** Replaces the value in memory; it goes out with the next save of any kind. */
  set(next: T): void
}

/** What a mod keeps on one kind of record: its value's empty state, and how it is read. */
export interface RecordFieldSpec<T> {
  /** The value while the record holds nothing for the mod. */
  empty: T
  /** The mod's own old keys on the record, read into `normalize` and removed by `with`. */
  legacy?: readonly string[]
  /** As {@link SaveFieldSpec.normalize}, for one record. */
  normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T
}

/** A mod's reader and writer for one kind of record, from {@link recordField}. */
export interface RecordFieldHandle<T> {
  /** The mod's value on `record`, or `empty`. Pure. */
  read(record: ModDataRecord): T
  /** A new record holding `next` as the mod's slice, without the legacy keys. Pure. */
  with<R extends ModDataRecord>(record: R, next: T): R
}

/** Where the live values are kept: core's game store, bound at its load. */
export interface SaveFieldStore {
  /** The value of each mod that has one this game, by id. */
  values: () => Readonly<Record<string, unknown>>
  set: (modId: string, value: unknown) => void
  subscribe: (onChange: () => void) => () => void
}

const fields = new Map<string, SaveFieldSpec<unknown>>()

let store: SaveFieldStore | null = null

/** Hands the handles the game store; null takes it away again. */
export function bindSaveFieldStore(next: SaveFieldStore | null): void {
  store = next
}

/** Every mod's registered save field this session, by id, whether the mod is on or off. */
export function saveFields(): ReadonlyMap<string, SaveFieldSpec<unknown>> {
  return fields
}

/** The version a slice the mod writes is stamped with; `0.0.0` for a mod `MODS` does not list. */
function versionOf(modId: string): string {
  return modById(modId)?.version ?? '0.0.0'
}

/** The slice `record` holds for `modId`, or undefined. */
function sliceOf(record: ModDataRecord, modId: string): ModSlice | undefined {
  const ex = record.ex
  return ex && typeof ex === 'object' && Object.hasOwn(ex, modId) ? ex[modId] : undefined
}

/** The legacy keys of `spec` that `record` holds, as read; none where there is no `normalize` to read them. */
function legacyOf(record: object, spec: RecordFieldSpec<unknown>): Record<string, unknown> {
  const keys = spec.normalize ? spec.legacy : undefined
  return Object.fromEntries(
    (keys ?? []).filter((key) => Object.hasOwn(record, key)).map((key) => [key, (record as Record<string, unknown>)[key]])
  )
}

/**
 * The mod's value from its slice and its legacy keys. Both go in as copies, so a `normalize` that
 * changes what it was handed, or a mod that later changes the value it returned, never changes
 * the data as read.
 */
function normalized<T>(spec: RecordFieldSpec<T>, stored: ModSlice | undefined, legacy: Record<string, unknown>): T {
  const data: unknown = structuredClone((stored as Partial<ModSlice> | null | undefined)?.data)
  if (!spec.normalize) return (data ?? spec.empty) as T
  const from = typeof stored?.v === 'string' ? stored.v : null
  return spec.normalize(data, structuredClone(legacy), from)
}

/** What a mod writes: its value, copied, under its version. */
function sliceFor(modId: string, value: unknown): ModSlice {
  return { v: versionOf(modId), data: structuredClone(value) }
}

/** A handle for a refused registration: it reads `empty` and writes nothing. */
function inertHandle<T>(empty: T): SaveFieldHandle<T> {
  return { read: () => empty, use: () => empty, set: () => {} }
}

/**
 * A mod's data in the save, registered once from its own files. Read on every load for as long
 * as the mod is registered, on or off, so a mod switched off finds its data where it left it.
 * During an installed mod's import, a field under another id is refused, as is a second field
 * under one id (which throws for an in-repo mod, whose bug it is); a refused field reads `empty`.
 */
export function saveField<T>(modId: string, spec: SaveFieldSpec<T>): SaveFieldHandle<T> {
  if (refusedAsForeign(modId, 'a save field')) return inertHandle(spec.empty)
  if (fields.has(modId)) {
    const message = `registered a second save field for \`${modId}\``
    const declared = declaredHooksNow()
    if (!declared?.declared(modId)) throw new Error(`[mods] ${modId}: ${message}`)
    declared.onRefused(modId, message)
    return inertHandle(spec.empty)
  }
  fields.set(modId, spec as SaveFieldSpec<unknown>)

  const read = (): T => {
    const values = store?.values()
    return values && Object.hasOwn(values, modId) ? (values[modId] as T) : spec.empty
  }
  const subscribe = (onChange: () => void): (() => void) => store?.subscribe(onChange) ?? (() => {})
  return {
    read,
    use: () => useSyncExternalStore(subscribe, read, read),
    set: (next) => {
      if (!store) throw new Error(`[mods] ${modId}: its save field was set before the game store was loaded`)
      store.set(modId, next)
    }
  }
}

/**
 * A mod's data on one kind of record inside the save (a character, a memory, a message, a post),
 * read and written by the mod itself wherever it has the record in hand. During an installed
 * mod's import, a field under another id is refused: it reads `empty` and `with` changes nothing.
 */
export function recordField<T>(modId: string, spec: RecordFieldSpec<T>): RecordFieldHandle<T> {
  const refused = refusedAsForeign(modId, 'a record field')
  return {
    read: (record) => {
      if (refused) return spec.empty
      const stored = sliceOf(record, modId)
      const legacy = legacyOf(record, spec)
      if (stored === undefined && Object.keys(legacy).length === 0) return spec.empty
      return normalized(spec, stored, legacy)
    },
    with: <R extends ModDataRecord>(record: R, next: T): R => {
      if (refused) return record
      const copy = { ...record } as Record<string, unknown>
      for (const key of (spec.normalize ? spec.legacy : undefined) ?? []) delete copy[key]
      copy.ex = { ...record.ex, [modId]: sliceFor(modId, next) }
      return copy as R
    }
  }
}

/** What a load makes of the save's mod data: each registered mod's value, and the legacy keys it took. */
export interface ReadModSlices {
  values: Record<string, unknown>
  /** The legacy keys a mod read into its value, which the save no longer needs. */
  consumed: string[]
}

/**
 * Every registered save field's value from `save`. A mod the save holds nothing for has no value;
 * one whose `normalize` throws has none either, and `onFailed` is told, its data left as read.
 */
export function readModSlices(save: ModDataRecord, onFailed: (modId: string, error: unknown) => void): ReadModSlices {
  const values: Record<string, unknown> = {}
  const consumed: string[] = []
  for (const [modId, spec] of fields) {
    const stored = sliceOf(save, modId)
    const legacy = legacyOf(save, spec)
    if (stored === undefined && Object.keys(legacy).length === 0) continue
    try {
      values[modId] = normalized(spec, stored, legacy)
      consumed.push(...Object.keys(legacy))
    } catch (error) {
      onFailed(modId, error)
    }
  }
  return { values, consumed }
}

/**
 * The save's `ex`: every slice as read, with each mod that has a value writing it on top under its
 * version. A value that cannot be copied is reported and its slice is left as read.
 */
export function writeModSlices(read: Readonly<Record<string, ModSlice>>, values: Readonly<Record<string, unknown>>): Record<string, ModSlice> {
  const ex: Record<string, ModSlice> = { ...read }
  for (const [modId, value] of Object.entries(values)) {
    try {
      ex[modId] = sliceFor(modId, value)
    } catch (error) {
      console.error(`[mods] ${modId}: its save data could not be written; it is kept as it was`, error)
    }
  }
  return ex
}

/**
 * What the next semester's first save starts with: each mod that has a value carries what its
 * `carry` makes of it, and starts empty without one; a slice no mod read this game (its mod not
 * registered, or its data unreadable) is carried as read. A `carry` that throws is reported and
 * its value is carried as it stands.
 */
export function carryModSlices(
  read: Readonly<Record<string, ModSlice>>,
  values: Readonly<Record<string, unknown>>,
  context: TermCarryContext
): Record<string, ModSlice> {
  const ex: Record<string, ModSlice> = {}
  for (const [modId, slice] of Object.entries(read)) {
    if (!Object.hasOwn(values, modId)) ex[modId] = slice
  }
  for (const [modId, value] of Object.entries(values)) {
    const carry = fields.get(modId)?.carry
    if (!carry) continue
    try {
      const next = carry(value, context)
      if (next !== undefined) ex[modId] = sliceFor(modId, next)
    } catch (error) {
      console.error(`[mods] ${modId}: its save data could not be carried; it is carried as it was`, error)
      ex[modId] = sliceFor(modId, value)
    }
  }
  return ex
}
