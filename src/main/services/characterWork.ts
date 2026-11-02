import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { assertSafeCharId } from '@shared/characterRules'
import { appError } from '@shared/errors'
import { runAbortable } from '@shared/jobQueue'

/**
 * Runs unqueued work belonging to a character. Her cancellation aborts it and waits for all
 * its writes and cleanup to settle. This does not queue: renderComfyImage may be called inside.
 * Every mod working for this character shares her cancellation lifetime.
 */
export async function runForCharacter<T>(
  modId: string,
  charId: string,
  work: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (typeof modId !== 'string' || !MOD_ID_RULE.test(modId)) {
    throw appError('MOD_ID_INVALID', 'Character work needs a valid mod id.')
  }
  assertSafeCharId(charId)
  return runAbortable(charId, async signal => {
    try {
      const result = await work(signal)
      if (signal.aborted) throw appError('CANCELLED', 'Character work was cancelled.')
      return result
    } catch (error) {
      if (signal.aborted) throw appError('CANCELLED', 'Character work was cancelled.')
      throw error
    }
  })
}
