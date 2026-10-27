import type { ModDef } from '@vx/modkit/shared'
import { normalizeTalents, type TalentState } from '../campusTalents'
import { registerTermCarry } from '../modCarry'
import { trainingAfterBreak } from '../talentTrading'
declare module '../modCarry' { interface ModCarryFields { exTalents?: TalentState } }
registerTermCarry('exTalents', (save, context) => {
  if (!save.exTalents) return undefined
  const s=normalizeTalents(save.exTalents)
  delete s.abilities.eureka
  delete s.abilities.farewell
  delete s.abilities.silverLining
  if (s.initialized) s.training=trainingAfterBreak(save.stats,context.term+1)
  return s
})
const mod: ModDef = {
  id:'campus-talents', name:'Campus Talents', author:'Maestro Leeds', version:'0.4.15', scope:'anytime', defaultOn:false,
  blurb:'Spend Bond Points on six skill trees. Earn more BP at lower stats and less at higher stats. Relationships are never spent.',
  offNote:'Keeps ranks, points and savings. Stops BP rewards and skill effects. Withdraw savings before switching off.'
}
export default mod
