import { describe, expect, it } from 'vitest'
import { compareVersions, parseRange, parseVersion, satisfies } from '../../packages/modkit/src/shared/range'

/** The version-range subset a manifest's `requires`, `optional` and `game` are written in. */

describe('parseVersion', () => {
  it('reads strict major.minor.patch and nothing looser', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 })
    for (const bad of ['1.2', '1', 'v1.2.3', '1.2.3-beta', '01.2.3', '1.2.3.4', '', 'x']) {
      expect(parseVersion(bad), bad).toBeNull()
    }
  })

  it('orders versions part by part', () => {
    const v = (text: string) => parseVersion(text) as NonNullable<ReturnType<typeof parseVersion>>
    expect(compareVersions(v('1.2.3'), v('1.2.3'))).toBe(0)
    expect(compareVersions(v('1.2.3'), v('1.10.0'))).toBe(-1)
    expect(compareVersions(v('2.0.0'), v('1.99.99'))).toBe(1)
  })
})

describe('satisfies', () => {
  const cases: [string, string, boolean][] = [
    ['1.2.3', '1.2.3', true],
    ['1.2.4', '1.2.3', false],
    ['1.2.3', '=1.2.3', true],
    ['1.5.0', '^1.2.3', true],
    ['1.2.2', '^1.2.3', false],
    ['2.0.0', '^1.2.3', false],
    ['0.2.9', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['1.2.3', '>=1.2.3', true],
    ['1.2.3', '>1.2.3', false],
    ['1.2.4', '>1.2.3', true],
    ['1.2.3', '<=1.2.3', true],
    ['1.2.3', '<1.2.3', false],
    ['1.9.9', '1.x', true],
    ['2.0.0', '1.x', false],
    ['1.2.9', '1.2.x', true],
    ['1.3.0', '1.2.x', false],
    ['1.2.9', '1.2', true],
    ['1.9.0', '1', true],
    ['9.9.9', '*', true],
    ['9.9.9', 'x', true],
    ['9.9.9', '', true],
    ['0.7.0', '>=0.6.0 <0.8.0', true],
    ['0.8.0', '>=0.6.0 <0.8.0', false],
    ['1.5.0', '^1.2.0 <1.4.0', false],
    ['1.3.0', '^1.2.0 <1.4.0', true]
  ]

  for (const [version, range, expected] of cases) {
    it(`${version} ${expected ? 'is' : 'is not'} in ${JSON.stringify(range)}`, () => {
      expect(satisfies(version, range)).toBe(expected)
    })
  }

  it('refuses text outside the subset, and a version that is not strict', () => {
    for (const bad of ['>=1.2.3 || <1.0.0', '1.2.3 - 1.4.0', 'latest', '^1.2.3-beta', '1.x.3', '>=1.2.3.4']) {
      expect(parseRange(bad), bad).toBeNull()
      expect(satisfies('1.2.3', bad), bad).toBe(false)
    }
    expect(satisfies('1.2', '^1.0.0')).toBe(false)
  })
})
