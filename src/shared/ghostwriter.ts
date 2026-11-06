import { endpointProblem } from './endpoint'
import type { ThinkingLevel } from './providers'
import type { SamplingKey } from './settingsRules'

/**
 * Ghostwriter: a scene call written in two, a writer's prose draft and a converter's JSON. The
 * shapes its main process keeps and its page reads, and when each stage is ready to run.
 */

export const GHOSTWRITER_MOD = 'ghostwriter'

/** The two calls a scene is split into. */
export type GhostwriterStage = 'writer' | 'converter'

/** One stage's endpoint as the page sees it: everything but the key, which it knows only is set. */
export interface GhostwriterEndpointView {
  /** The chat completions root, as typed; blank is none. */
  url: string
  /** The model id, as typed; blank is none. */
  model: string
  /** Sent as `reasoning_effort`; absent sends minimal. */
  reasoningEffort?: ThinkingLevel
  /** Sent as `max_tokens`; absent sends the game's pinned ceiling. */
  maxOutputTokens?: number
  keySet: boolean
}

/** The writer's endpoint, with the sampler values it alone is sent. */
export interface GhostwriterWriterView extends GhostwriterEndpointView {
  sampling: Partial<Record<SamplingKey, number>>
}

/** Both stages as the page sees them. */
export interface GhostwriterView {
  writer: GhostwriterWriterView
  converter: GhostwriterEndpointView
}

/**
 * A change to one stage, written as it is made. `key` replaces the stored key, blank clearing it;
 * an optional number or level written as `null` clears it back to absent.
 */
export interface GhostwriterPatch {
  stage: GhostwriterStage
  url?: string
  model?: string
  key?: string
  reasoningEffort?: ThinkingLevel | null
  maxOutputTokens?: number | null
  /** The writer's alone; `null` clears a value. */
  sampling?: Partial<Record<SamplingKey, number | null>>
}

/** The methods its main entry answers through `invoke`, by name. */
export const GHOSTWRITER_CALLS = {
  /** `() => GhostwriterView` */
  read: 'read-config',
  /** `(patch: GhostwriterPatch) => GhostwriterView` */
  write: 'write-config',
  /** `(stage: GhostwriterStage) => void`, throwing the failure the endpoint answered. */
  test: 'test-endpoint',
  /** `(stage: GhostwriterStage) => string[]`, empty where the endpoint lists nothing. */
  models: 'list-models'
} as const

/** Whether the writer can run: a well-formed URL and a model. Until it can, scenes go as built. */
export function writerReady(view: Pick<GhostwriterEndpointView, 'url' | 'model'>): boolean {
  return endpointProblem(view.url) === null && view.model.trim() !== ''
}

/** Whether the converter has an endpoint of its own; blank leaves conversion to the game's model. */
export function converterOwnEndpoint(view: Pick<GhostwriterEndpointView, 'url'>): boolean {
  return view.url.trim() !== ''
}

/**
 * The one line naming why a converter endpoint of its own cannot run, null where it can or where
 * there is none.
 */
export function converterProblem(view: Pick<GhostwriterEndpointView, 'url' | 'model'>): string | null {
  if (!converterOwnEndpoint(view)) return null
  const problem = endpointProblem(view.url, 'converter URL')
  if (problem) return problem
  return view.model.trim() === '' ? 'Enter the converter\'s model ID.' : null
}
