import type { SceneLine } from '@shared/types'

/**
 * The lines a mod put on the scene for the moment only, each with the mod that said it. Keyed by
 * the line itself, which keeps its identity from the queue to the log and the box: a line read
 * back from a save is a new object and was never marked, and a line no record holds any longer
 * is forgotten with it.
 */
const owners = new WeakMap<SceneLine, string>()

/** Marks lines as `modId`'s, to be taken back off the scene by it and left out of any save. */
export function markTransient(modId: string, lines: readonly SceneLine[]): void {
  for (const line of lines) owners.set(line, modId)
}

/** The mod a transient line belongs to, or undefined for a line that stays. */
export function transientOwner(line: SceneLine): string | undefined {
  return owners.get(line)
}
