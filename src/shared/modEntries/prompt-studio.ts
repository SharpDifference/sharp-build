import type { ModDef } from '../mods'
import { PROMPT_STUDIO_MOD } from '../presets/types'
import '../presets/presetVarsCarry'

const mod: ModDef = {
  id: PROMPT_STUDIO_MOD, name: 'Prompt Studio', author: 'mtabbada', version: '1.0.0',
  scope: 'anytime', defaultOn: false,
  blurb: 'Shape scenes with SillyTavern or Marinara presets, and rewrite the game\'s own prompts.',
  offNote: 'Presets and prompt edits stay saved. The game sends its own prompts.'
}
export default mod
