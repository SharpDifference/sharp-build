import { describe, expect, it } from 'vitest'
import { orderMods, type OrderInput } from '../../src/main/mods/order'

/** A loadable mod at 1.0.0, named after its id in capitals, with whatever `over` adds. */
function mod(id: string, over: Partial<OrderInput> = {}): OrderInput {
  return { id, name: id.toUpperCase(), version: '1.0.0', loadable: true, ...over }
}

describe('orderMods', () => {
  it('loads a chain from the bottom up', () => {
    const result = orderMods([mod('c', { requires: { b: '^1.0.0' } }), mod('b', { requires: { a: '*' } }), mod('a')])
    expect(result).toEqual({ order: ['a', 'b', 'c'], blocked: {}, optionalPresent: {}, warnings: {} })
  })

  it('loads a diamond with its shared dependency first and its joining mod last', () => {
    const result = orderMods([
      mod('d', { requires: { c: '*', b: '*' } }),
      mod('c', { requires: { a: '*' } }),
      mod('b', { requires: { a: '*' } }),
      mod('a')
    ])
    expect(result.order).toEqual(['a', 'b', 'c', 'd'])
  })

  it('breaks ties by id, whatever order the mods come in', () => {
    const ids = ['zeta', 'alpha', 'mid']
    expect(orderMods(ids.map((id) => mod(id))).order).toEqual(['alpha', 'mid', 'zeta'])
    expect(orderMods([...ids].reverse().map((id) => mod(id))).order).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('blocks the mods on a cycle with its path, and a mod behind it naming the member it needs', () => {
    const result = orderMods([
      mod('a', { requires: { b: '*' } }),
      mod('b', { requires: { a: '*' } }),
      mod('c', { requires: { b: '*' } }),
      mod('free')
    ])
    expect(result.order).toEqual(['free'])
    expect(result.blocked).toEqual({
      a: 'requires itself through a → b → a',
      b: 'requires itself through b → a → b',
      c: 'needs B, which did not load'
    })
  })

  it('blocks a mod whose requirement is not installed', () => {
    const result = orderMods([mod('photo-feature', { requires: { 'mini-games': '^1.0.0' } })])
    expect(result.blocked).toEqual({ 'photo-feature': 'needs mini-games, which is not installed' })
    expect(result.order).toEqual([])
  })

  it('blocks a mod whose requirement is out of range, and the mods that need it in turn', () => {
    const result = orderMods([
      mod('mini-games', { name: 'Mini-games', version: '1.4.0' }),
      mod('photo-feature', { name: 'Photo feature', requires: { 'mini-games': '^2.0.0' } }),
      mod('album', { requires: { 'photo-feature': '*' } })
    ])
    expect(result.order).toEqual(['mini-games'])
    expect(result.blocked).toEqual({
      'photo-feature': 'needs Mini-games ^2.0.0, 1.4.0 is installed',
      album: 'needs Photo feature, which did not load'
    })
  })

  it('blocks a mod whose requirement cannot load, leaving the requirement itself to the caller', () => {
    const result = orderMods([
      mod('mini-games', { name: 'Mini-games', loadable: false }),
      mod('photo-feature', { requires: { 'mini-games': '^1.0.0' } })
    ])
    expect(result.order).toEqual([])
    expect(result.blocked).toEqual({ 'photo-feature': 'needs Mini-games, which did not load' })
  })

  it('loads an optional dependency in range first, and passes over one absent or out of range', () => {
    const result = orderMods([
      mod('album', { optional: { zine: '^1.0.0', ghost: '*', 'photo-feature': '^2.0.0' } }),
      mod('zine'),
      mod('photo-feature', { version: '1.4.0' })
    ])
    expect(result).toEqual({
      order: ['photo-feature', 'zine', 'album'],
      blocked: {},
      optionalPresent: { album: ['zine'] },
      warnings: { album: ['optional photo-feature ^2.0.0: 1.4.0 is installed, left out'] }
    })
  })
})
