import { samplingOf } from '../settingsRules'
import type { StructuredRequest } from '../types'
import { applyPreset } from './assemble'
import { applyVarOps, readPresetVars } from './varOps'
import type { Preset } from './types'

/** What applying a preset to a request leaves for reading its reply back. */
export interface AppliedPreset {
  /** The variables after the preset's own macros ran, which the model's ops then change. */
  vars: Record<string, string>
}

/** One request made ready for the provider: the fields only this app reads are gone. */
export interface PresetPlan {
  request: StructuredRequest
  /** The preset's samplers under their wire keys; the transport sends them to a custom endpoint alone. */
  sampling: Record<string, number>
  /** Set only when a preset was applied. */
  applied: AppliedPreset | null
}

/** The request without the three local-only fields every scene call carries. */
export function withoutPresetFields(request: StructuredRequest): StructuredRequest {
  const { parts: _parts, preset: _preset, sceneSpot: _spot, ...clean } = request
  return clean
}

/**
 * Prepares a request for the provider. With a request that asks for a preset and a loaded
 * `preset`, the preset is applied and its samplers returned; otherwise the request goes on as it
 * is. Either way the local-only fields are stripped.
 */
export function planPresetRequest(
  request: StructuredRequest,
  preset: Preset | null,
  rand: () => number = Math.random
): PresetPlan {
  const clean = withoutPresetFields(request)
  if (!request.preset || !preset) return { request: clean, sampling: {}, applied: null }

  const { names, vars } = request.preset
  const out = applyPreset(
    { system: request.system, user: request.user, schema: request.schema, parts: request.parts },
    preset,
    readPresetVars(vars),
    { user: names.user, char: names.char, group: names.group, rand }
  )
  // The preset moves the user text, so an offset into the old one points at nothing.
  const { logFrom: _logFrom, ...rest } = clean
  return {
    request: { ...rest, system: out.system, user: out.user, schema: out.schema },
    sampling: samplingOf({ apiProvider: 'openai', ...preset.sampling }),
    applied: { vars: out.vars }
  }
}

/**
 * Reads a preset call's reply back: the model's `vars` ops are applied to the variables the call
 * began with and the reply carries the result as `presetVars` instead. Returns the warnings the
 * ops earned. A reply from a call with no preset applied is left alone.
 */
export function finishPresetReply(reply: unknown, applied: AppliedPreset | null): string[] {
  if (!applied || typeof reply !== 'object' || reply === null || Array.isArray(reply)) return []
  const body = reply as Record<string, unknown>
  const { vars, warnings } = applyVarOps(applied.vars, body.vars)
  delete body.vars
  body.presetVars = vars
  return warnings
}
