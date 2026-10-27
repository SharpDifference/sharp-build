import { hasTrait, registerCharacterTrait } from '../traits'
import { registerRomanceRequirement } from '../romanceRequirements'
import type { ModDef } from '@vx/modkit/shared'
import { MAX_TIER, pointsForTier } from '../playerStats'
registerCharacterTrait('godlike-standards', {
  value: 'Godlike',
  description: 'requires Godly Brain, Body and Heart before beginning a romance',
  editor: true,
  generated: false,
  tone: 'gold',
  hint: 'Godlike requires Brain, Body and Heart all at Godly before romance can begin. Applies while Godlike Standards is on.'
})
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
