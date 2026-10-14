import { carryWhisper, type VenusWhisper } from './venusWhisper'
import { registerTermCarry } from './modCarry'

declare module './modCarry' { interface ModCarryFields { exVenusWhisper?: VenusWhisper } }
registerTermCarry('exVenusWhisper', (save, context) => save.exVenusWhisper ? carryWhisper(save.exVenusWhisper, context.term, save.date, save.charInfo) : undefined)
