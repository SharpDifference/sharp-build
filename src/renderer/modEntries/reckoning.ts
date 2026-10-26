import { unspokenSceneBoundary } from '@shared/unspokenVoice'
import { CHARACTER_DYNAMICS_MOD } from '@shared/characterDynamics'
import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type ScreenSlotProps } from '../mods/hooks'
import { earnedGrowthLines } from '../prompts/characterDynamics'
import { modIsOn } from '../stores/modsStore'
import { loopState } from '../stores/loop/state'

const dynamicsOn = (): boolean => modIsOn(CHARACTER_DYNAMICS_MOD, loopState.record)

const LazyMapPin = lazy(() => import('../views/ReckoningDungeon').then(module => ({
  default: module.ReckoningDungeonMapPin
})))

function DungeonEntrance({ canTravel, close }: ScreenSlotProps['mapOverlay']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null },
    createElement(LazyMapPin, { canTravel, onEnter: close }))
}

// Character Dynamics supplies this history when enabled. Do not duplicate its prompt.
registerHooks('reckoning', {
  mapOverlay: DungeonEntrance,
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
