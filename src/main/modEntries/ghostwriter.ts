import { GHOSTWRITER_CALLS, type GhostwriterPatch, type GhostwriterStage } from '@shared/ghostwriter'
import { appError } from '@shared/errors'
import type { InvokeHandler } from '../mods/invoke'
import {
  listStageModels,
  readView,
  registerGhostwriterSender,
  testEndpoint,
  writePatch
} from '../services/ghostwriterService'

/** The stage an argument names, or a refusal. */
function stageArg(value: unknown): GhostwriterStage {
  if (value !== 'writer' && value !== 'converter') {
    throw appError('GHOSTWRITER_PATCH_INVALID', 'Ghostwriter has no such stage.')
  }
  return value
}

/** Registers Ghostwriter's request sender and answers the page's calls. */
export default function ghostwriter(): { invoke: Record<string, InvokeHandler> } {
  registerGhostwriterSender()
  return {
    invoke: {
      [GHOSTWRITER_CALLS.read]: () => readView(),
      [GHOSTWRITER_CALLS.write]: (_ctx, patch) => writePatch(patch as GhostwriterPatch),
      [GHOSTWRITER_CALLS.test]: async (_ctx, stage) => { await testEndpoint(stageArg(stage)) },
      [GHOSTWRITER_CALLS.models]: (_ctx, stage) => listStageModels(stageArg(stage))
    }
  }
}
