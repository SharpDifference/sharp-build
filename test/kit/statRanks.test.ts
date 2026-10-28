import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_TIER, pointsForTier, registerRomanceRequirement, type PlayerStats, type StatTier } from '@vx/modkit/shared'
import { checkCompat, setSharedModRules } from '@vx/modkit/host/shared'
import { blocksNewRomance } from '@shared/romanceRequirements'
import { tierOf } from '@shared/playerStats'
import { requireMain, UndeclaredApiError } from '../../src/main/mods/require'

const MOD = 'test-native-rank-requirement'
afterEach(() => setSharedModRules(() => false))

describe('public native stat-rank readers', () => {
  it('uses native rank boundaries for all three romance requirements and respects the switch', () => {
    registerRomanceRequirement(MOD, () => {
      const minimum = pointsForTier(MAX_TIER)
      return { brain: minimum, body: minimum, heart: minimum }
    })
    setSharedModRules(id => id === MOD)
    const tier: StatTier = MAX_TIER
    const minimum = pointsForTier(tier)
    const stats: PlayerStats = { brain: minimum, body: minimum, heart: minimum }
    expect(tierOf(minimum)).toBe(MAX_TIER)
    expect(blocksNewRomance(undefined, stats)).toBe(false)
    for (const key of ['brain', 'body', 'heart'] as const) {
      expect(tierOf(minimum - 0.01)).toBeLessThan(MAX_TIER)
      expect(blocksNewRomance(undefined, { ...stats, [key]: minimum - 0.01 })).toBe(true)
    }
    setSharedModRules(() => false)
    expect(blocksNewRomance(undefined, { brain: -100, body: -100, heart: -100 })).toBe(false)
  })

  it('exposes both names through the main loader proxy only when the manifest declares them', () => {
    const folder = mkdtempSync(join(tmpdir(), 'vu-kit-ranks-'))
    try {
      const file = join(folder, 'main.js')
      writeFileSync(file, "const { MAX_TIER, pointsForTier } = require('@vx/modkit/shared'); module.exports = pointsForTier(MAX_TIER);")
      const declared = new Set(['shared:MAX_TIER', 'shared:pointsForTier'])
      expect(checkCompat([...declared]).status).toBe('loads')
      const context = { id: MOD, folder, file, declared, dependencies: new Set<string>(), libraries: new Map<string, unknown>() }
      expect(requireMain(context)).toBe(pointsForTier(MAX_TIER))
      for (const missing of declared) {
        expect(() => requireMain({ ...context, declared: new Set([...declared].filter(name => name !== missing)) })).toThrow(UndeclaredApiError)
      }
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })
})
