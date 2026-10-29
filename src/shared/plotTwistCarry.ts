import { registerTermCarry } from './modCarry'

declare module './modCarry' { interface ModCarryFields { exPlotTwist?: string } }

// Old, already-prepared semester continuations can still carry mods.exPlotTwist.
// Keep accepting that field into their opening save so saveField.normalize can read it.
// Current saves no longer write it: their continuation uses saveField.carry and carry.ex.
registerTermCarry('exPlotTwist', save => typeof save.exPlotTwist === 'string' ? save.exPlotTwist : undefined)
