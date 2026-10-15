import { unspokenSceneBoundary } from '@shared/unspokenVoice'
import { CHARACTER_DYNAMICS_MOD } from '@shared/characterDynamics'
import { registerHooks } from '../mods/hooks'
import { earnedGrowthLines } from '../prompts/characterDynamics'
import { modIsOn } from '../stores/modsStore'
import { loopState } from '../stores/loop/state'

const dynamicsOn = (): boolean => modIsOn(CHARACTER_DYNAMICS_MOD, loopState.record)

// Character Dynamics supplies this history when enabled. Do not duplicate its prompt.
registerHooks('reckoning', {
  prompts: {
    scene: { lines: ({ cast, state }) => [...(dynamicsOn() ? [] : earnedGrowthLines(cast, state.exCharacterDynamics)),...unspokenSceneBoundary(state.exReckoning)] },
    dm: { lines: ({ character, state }) => dynamicsOn() ? [] : earnedGrowthLines([character], state.exCharacterDynamics) }
  },
  requests: {
    'slot-intro': (request, { input }) => {
      if (dynamicsOn()) return request
      const lines = earnedGrowthLines([...input.askers, ...input.breakups, ...input.posters].map(person => person.character), input.exCharacterDynamics)
      return lines.length ? { ...request, user: `${request.user}\n\n${lines.join('\n')}` } : request
    }
  }
})
