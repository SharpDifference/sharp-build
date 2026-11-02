import { completeStructured } from '@shared/llm/cloudLlm'
import { sharedModOn } from '@shared/modRules'
import { samplingOf, type SamplingKey } from '@shared/settingsRules'
import type { Settings, StructuredRequest } from '@shared/types'

/** What a mod's request hook leaves for the one call: the request to send and how its reply is read. */
export interface FinalRequestPlan {
  request: StructuredRequest
  /** Sampler values for this call alone; a custom endpoint is the only one that takes them. */
  sampling?: Partial<Pick<Settings, SamplingKey>>
  /** Reads the parsed reply; what it returns reaches the window as `modReply[<mod id>]`. */
  finish?: (reply: Record<string, unknown>) => unknown
}

/** `tag` is what the mod's window-side `sceneCall` hook tagged the call with. */
export type FinalRequestHook = (
  request: StructuredRequest,
  ctx: { tag: unknown }
) => FinalRequestPlan | null | Promise<FinalRequestPlan | null>

const hooks = new Map<string, { hook: FinalRequestHook }>()

/** Trusted main-process setup only; the owner removes its registration when deactivated. */
export function registerFinalRequest(modId: string, hook: FinalRequestHook): () => void {
  if (!modId.trim() || modId !== modId.trim() || typeof hook !== 'function') {
    throw Error('A final request hook needs an owner and a hook.')
  }
  if (hooks.has(modId)) throw Error(`A final request hook is already registered by ${modId}.`)
  const entry = { hook }
  hooks.set(modId, entry)
  return () => { if (hooks.get(modId) === entry) hooks.delete(modId) }
}

/** Whether the value is a plan a hook may hand back. */
function isPlan(value: unknown): value is FinalRequestPlan {
  const request = (value as FinalRequestPlan | null)?.request
  return typeof request === 'object' && request !== null &&
    typeof request.system === 'string' && typeof request.user === 'string'
}

/**
 * Sends one structured request. The first enabled mod whose id is a key of `modTags` gets to
 * rewrite it and read its reply; a mod that fails costs nothing but a warning, and the request
 * goes as built. The fields only this app reads never reach the provider.
 */
export async function completeWithFinalRequest<T>(
  request: StructuredRequest,
  signal?: AbortSignal,
  onDelta?: (delta: string) => void
): Promise<T> {
  const tagged = Object.keys(request.modTags ?? {})
    .filter((id) => hooks.has(id) && sharedModOn(id))
    .sort()
  if (tagged.length === 0) return completeStructured<T>(request, signal, onDelta)

  const [owner, ...skipped] = tagged
  if (skipped.length > 0) {
    console.warn(`[mods] ${owner}: also tagged by ${skipped.join(', ')}, which are skipped`)
  }
  let plan: FinalRequestPlan | null = null
  try {
    const made = await hooks.get(owner)!.hook(request, { tag: request.modTags![owner] })
    if (made !== null && !isPlan(made)) throw Error('returned something that is not a plan')
    plan = made
    if (!plan) console.warn(`[mods] ${owner}: no plan for this call; it goes as built`)
  } catch (error) {
    console.warn(`[mods] ${owner}: final request failed; it goes as built`, error)
  }
  if (!plan) return completeStructured<T>(request, signal, onDelta)

  const sampling = samplingOf({ apiProvider: 'openai', ...plan.sampling })
  const reply = await completeStructured<T>(plan.request, signal, onDelta, undefined, sampling)
  if (plan.finish && typeof reply === 'object' && reply !== null && !Array.isArray(reply)) {
    try {
      const result = plan.finish(reply as Record<string, unknown>)
      if (result !== undefined) {
        ;(reply as Record<string, unknown>).modReply = { [owner]: result }
      }
    } catch (error) {
      console.warn(`[mods] ${owner}: reading the reply failed`, error)
    }
  }
  return reply
}
