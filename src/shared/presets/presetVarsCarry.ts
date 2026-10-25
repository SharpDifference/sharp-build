import { registerTermCarry } from '../modCarry'
import { readPresetVars } from './varOps'

declare module '../modCarry' {
  interface ModCarryFields { presetVars?: Record<string, string> }
}

// The variables go into the next semester whole, with the switch on or off; none carries as absent.
registerTermCarry('presetVars', (save) => {
  const vars = readPresetVars(save.presetVars)
  return Object.keys(vars).length > 0 ? vars : undefined
})
