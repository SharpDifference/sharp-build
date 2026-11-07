import { registerHooks } from '@vx/modkit/renderer'
import { GHOSTWRITER_MOD } from '../../shared/ghostwriter'
import { converterTextOf } from '../../shared/ghostwriterPrompt'
import { GhostwriterPage } from '../views/GhostwriterPage'

registerHooks(GHOSTWRITER_MOD, {
  // Marks every scene call, which main splits into the writer's draft and the converter's
  // script, with the converter's text cut here, before any preset is laid over the request.
  sceneCall: (ctx) => {
    const converter = converterTextOf(ctx.request)
    return converter ? { converter } : {}
  },
  modDetail: (mod) => (mod.id === GHOSTWRITER_MOD ? GhostwriterPage : undefined)
})
