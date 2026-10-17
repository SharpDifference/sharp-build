import type { ModDef } from '../mods'
import { CHARACTER_DYNAMICS_MOD } from '../characterDynamics'
import '../characterDynamicsCarry'

const mod: ModDef = {
  id: CHARACTER_DYNAMICS_MOD,
  name: 'Character Dynamics',
  author: 'Maestro Leeds',
  version: '1.0.1',
  scope: 'playthrough',
  defaultOn: false,
  blurb: 'Choose shared history and gentle personality nudges for individual girls when starting a playthrough. Multiple tags, one setup screen.',
  requires: [],
  options: []
}
export default mod
