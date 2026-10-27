/**
 * Version ranges, the small subset a manifest's `requires`, `optional` and `game` fields are
 * written in: `1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.3`, `>1.2.3`, `<=1.2.3`, `<1.2.3`, `1.x`,
 * `1.2.x`, `*`, and several of those separated by spaces, all of which must hold. Versions are
 * strict `major.minor.patch`. Pure, with no dependency, so the loader in main and the Mods
 * screen read a range the same way.
 */

export interface Version {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** A strict `major.minor.patch`, or null for anything else (a `v`, a prerelease, a partial). */
export function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  for (const part of ['major', 'minor', 'patch'] as const) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  return 0
}

export type ComparatorOp = '=' | '>' | '>=' | '<' | '<='

export interface Comparator {
  readonly op: ComparatorOp
  readonly version: Version
}

/** Every comparator must hold; the empty range (`*`) holds for every version. */
export type Range = readonly Comparator[]

/** A version with the parts a range may leave out: `1`, `1.2`, `1.x`, `1.2.x`. */
interface Partial {
  readonly major: number
  readonly minor: number | null
  readonly patch: number | null
}

const PART = /^(0|[1-9]\d*|x|X|\*)$/

function parsePartial(text: string): Partial | null {
  const parts = text.split('.')
  if (parts.length === 0 || parts.length > 3 || !parts.every((part) => PART.test(part))) return null
  const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : null))
  if (numbers[0] === null) return { major: -1, minor: null, patch: null }
  // Nothing may follow an `x`: `1.x.3` names no version.
  if (numbers[1] === null && numbers.length === 3 && numbers[2] !== null) return null
  return { major: numbers[0], minor: numbers[1] ?? null, patch: numbers[1] === null ? null : (numbers[2] ?? null) }
}

const filled = (p: Partial): Version => ({ major: p.major, minor: p.minor ?? 0, patch: p.patch ?? 0 })

/** The comparators one token of a range stands for, or null where it is not one. */
function parseComparator(token: string): Comparator[] | null {
  const match = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token)
  if (!match) return null
  const op = match[1] ?? ''
  const partial = parsePartial(match[2])
  if (!partial) return null
  // `*` or `x` alone, under any operator, is every version.
  if (partial.major < 0) return []
  const low = filled(partial)
  const next = (p: Partial): Version =>
    p.minor === null
      ? { major: p.major + 1, minor: 0, patch: 0 }
      : p.patch === null
        ? { major: p.major, minor: p.minor + 1, patch: 0 }
        : { major: p.major, minor: p.minor, patch: p.patch + 1 }

  switch (op) {
    case '':
    case '=':
      // A partial on its own is the whole series it names: `1.2` is `>=1.2.0 <1.3.0`.
      if (partial.patch === null) return [{ op: '>=', version: low }, { op: '<', version: next(partial) }]
      return [{ op: '=', version: low }]
    case '^': {
      const high: Version =
        low.major > 0
          ? { major: low.major + 1, minor: 0, patch: 0 }
          : low.minor > 0 || partial.minor === null
            ? { major: 0, minor: low.minor + 1, patch: 0 }
            : partial.patch === null
              ? { major: 0, minor: 1, patch: 0 }
              : { major: 0, minor: 0, patch: low.patch + 1 }
      return [{ op: '>=', version: low }, { op: '<', version: high }]
    }
    case '~':
      return [
        { op: '>=', version: low },
        { op: '<', version: partial.minor === null ? { major: low.major + 1, minor: 0, patch: 0 } : { major: low.major, minor: low.minor + 1, patch: 0 } }
      ]
    case '>':
      // Past a series is past its last member: `>1.2` is `>=1.3.0`.
      if (partial.patch === null) return [{ op: '>=', version: next(partial) }]
      return [{ op: '>', version: low }]
    case '<=':
      if (partial.patch === null) return [{ op: '<', version: next(partial) }]
      return [{ op: '<=', version: low }]
    case '>=':
      return [{ op: '>=', version: low }]
    case '<':
      return [{ op: '<', version: low }]
    default:
      return null
  }
}

/** The range a manifest wrote, or null where the text is outside the subset. */
export function parseRange(text: string): Range | null {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed === '*' || trimmed === 'x' || trimmed === 'X') return []
  const range: Comparator[] = []
  for (const token of trimmed.split(/\s+/)) {
    const comparators = parseComparator(token)
    if (comparators === null) return null
    range.push(...comparators)
  }
  return range
}

function holds(version: Version, comparator: Comparator): boolean {
  const order = compareVersions(version, comparator.version)
  switch (comparator.op) {
    case '=':
      return order === 0
    case '>':
      return order > 0
    case '>=':
      return order >= 0
    case '<':
      return order < 0
    case '<=':
      return order <= 0
  }
}

/**
 * Whether a version is in a range. Either one given as text is parsed first; text outside the
 * subset, or a version that is not strict, satisfies nothing.
 */
export function satisfies(version: string | Version, range: string | Range): boolean {
  const parsedVersion = typeof version === 'string' ? parseVersion(version) : version
  const parsedRange = typeof range === 'string' ? parseRange(range) : range
  if (!parsedVersion || !parsedRange) return false
  return parsedRange.every((comparator) => holds(parsedVersion, comparator))
}
