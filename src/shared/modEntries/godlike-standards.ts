import type { ModDef } from '../mods'
import { MAX_TIER, pointsForTier } from '../playerStats'
import { registerRomanceRequirement } from '../romanceRequirements'
import { hasTrait } from '../traits'

registerRomanceRequirement('godlike-standards', character => {
  if (!hasTrait(character, 'Godlike')) return null
  const godly = pointsForTier(MAX_TIER)
  return { brain: godly, body: godly, heart: godly }
})

const mod: ModDef = {
  id: 'godlike-standards', name: 'Godlike Standards', author: 'Maestro Leeds',
  version: '0.1.0', scope: 'anytime', defaultOn: false,
  blurb: 'Add the gold Godlike trait in Manage Characters → Edit → Traits. Tagged characters require Godly Brain, Body and Heart before romance can begin. Friendship can grow normally.',
  offNote: 'Keeps the character’s tag but stops its extra requirement. Does not change stat gains, semester decay or established relationships.'
}
export default mod
