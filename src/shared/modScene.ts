import type { ModSceneFields } from './types'

/** A deep copy of what mods keep with a scene, or undefined where no mod keeps anything. */
export function savedModScene(fields: Readonly<ModSceneFields>): ModSceneFields | undefined {
  const kept = Object.entries(fields).filter(([, value]) => value !== undefined)
  return kept.length > 0 ? (structuredClone(Object.fromEntries(kept)) as ModSceneFields) : undefined
}

/**
 * `saved` with each of `keys` as `live` holds it, or taken out where `live` holds none, every
 * other key as it was: a deep copy, or undefined where no mod keeps anything.
 */
export function modSceneWith(
  saved: Readonly<ModSceneFields> | undefined,
  keys: readonly string[],
  live: Readonly<ModSceneFields>
): ModSceneFields | undefined {
  const fields: Record<string, unknown> = { ...saved }
  const from = live as Readonly<Record<string, unknown>>
  for (const key of keys) {
    if (Object.hasOwn(from, key)) fields[key] = from[key]
    else delete fields[key]
  }
  return savedModScene(fields as ModSceneFields)
}
