import type { ModDef } from '../mods'
import { registerTermCarry } from '../modCarry'
import { readStartingChallenge, STARTING_CHALLENGE_MOD, type StartingChallenge } from '../startingChallenge'

declare module '../modCarry' {
  interface ModCarryFields { exStartingChallenge?: StartingChallenge }
}
registerTermCarry('exStartingChallenge', save => readStartingChallenge(save.exStartingChallenge))

const mod: ModDef = {
  id: STARTING_CHALLENGE_MOD,
  name: 'Starting Challenge',
  author: 'Maestro Leeds',
  version: '0.3.0',
  scope: 'playthrough',
  defaultOn: false,
  blurb: 'Add Struggling (−30), Rock Bottom (−60), Life’s Punchline (−80) and Peaked in the Womb (−100) to the normal starting-stat controls. Choose Brain, Body and Heart independently in New Game or Quickstart; the arrows show rank titles without numbers. Works with or without Campus Talents.',
  offNote: 'Affects new playthroughs only. Each stat keeps its chosen floor and earned progress. Existing challenge saves retain their original floors.'
}
export default mod
