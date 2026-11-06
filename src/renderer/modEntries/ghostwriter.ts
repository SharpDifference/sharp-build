import { registerHooks } from '@vx/modkit/renderer'
import { GHOSTWRITER_MOD } from '../../shared/ghostwriter'
import { GhostwriterPage } from '../views/GhostwriterPage'

registerHooks(GHOSTWRITER_MOD, {
  // Marks every scene call; main splits it into the writer's draft and the converter's script.
  sceneCall: () => true,
  modDetail: (mod) => (mod.id === GHOSTWRITER_MOD ? GhostwriterPage : undefined)
})
