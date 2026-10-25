import { sharedModOn } from './modRules'
import { STAT_KEYS, type PlayerStats, type StatKey } from './playerStats'
import type { Character, CharFlags } from './types'

type RomanceCharacter = Pick<Character, 'traits' | 'preferredStat'> | undefined
type Requirement = (character: RomanceCharacter) => Partial<PlayerStats> | null
const requirements = new Map<string, Requirement>()
let enabled: (modId: string) => boolean = sharedModOn

/** Optional, additive requirements. With no active mod the native rules are untouched. */
export function registerRomanceRequirement(modId: string, requirement: Requirement): void {
  requirements.set(modId, requirement)
}

/** The renderer supplies the same switch/record lookup used by its other mod hooks. */
export function setRomanceRequirementRules(isOn: (modId: string) => boolean): void {
  enabled = isOn
}

export function romanceMinimumsOf(character: RomanceCharacter): Partial<PlayerStats> {
  const minimums: Partial<PlayerStats> = {}
  for (const [id, requirement] of requirements) {
    if (!enabled(id)) continue
    const added = requirement(character)
    for (const key of STAT_KEYS) {
      const value = added?.[key]
      if (value !== undefined && Number.isFinite(value)) {
        minimums[key] = Math.max(minimums[key] ?? -Infinity, value)
      }
    }
  }
  return minimums
}

export function missingRomanceStatOf(character: RomanceCharacter, stats: PlayerStats): StatKey | null {
  const minimums = romanceMinimumsOf(character)
  return STAT_KEYS.find(key => minimums[key] !== undefined &&
    (!Number.isFinite(stats[key]) || stats[key] < minimums[key]!)) ?? null
}

/** Starting a romance, not an upkeep rule. Existing lovers use the normal game rules. */
export function blocksNewRomance(
  character: RomanceCharacter, stats: PlayerStats, flags?: CharFlags
): boolean {
  return !flags?.isLover && missingRomanceStatOf(character, stats) !== null
}
