import { describe, expect, it } from 'vitest'
import { nativeDefaultPreset } from '@shared/presets/gameParts'
import { listingOf, repairedLibrary, withoutPreset } from '@shared/presets/presetLibrary'
import { toPresetFile } from '@shared/presets/presetRules'
import { finishPresetReply, planPresetRequest } from '@shared/presets/request'
import type { StructuredRequest } from '@shared/types'

const request = (): StructuredRequest => ({
  system: 'PERSONA\n\nRULES',
  user: 'NOW\n\nYOUR TURN',
  schema: { name: 'scene', schema: { type: 'object', properties: { lines: { type: 'array' } } } },
  parts: [
    { id: 'persona', role: 'system', text: 'PERSONA' },
    { id: 'jsonRules', role: 'system', text: 'RULES' },
    { id: 'now', role: 'user', text: 'NOW' },
    { id: 'yourTurn', role: 'user', text: 'YOUR TURN' }
  ],
  sceneSpot: { spot: 'opening', cast: ['Ada'] },
  preset: { spot: 'opening', playthroughId: 'p', vars: { mood: 'wary' }, names: { user: 'Sam', char: 'Ada', group: 'Ada' } },
  logFrom: 3
})

describe('a scene request on its way to the provider', () => {
  it('never carries the local-only fields, preset or not, and adds no vars without one', () => {
    const plan = planPresetRequest(request(), null)
    expect(plan.request).not.toHaveProperty('parts')
    expect(plan.request).not.toHaveProperty('preset')
    expect(plan.request).not.toHaveProperty('sceneSpot')
    expect(plan.request.user).toBe('NOW\n\nYOUR TURN')
    expect(plan.request.schema.schema.properties).not.toHaveProperty('vars')
    expect(plan.applied).toBeNull()
  })

  it('applies the preset, then reads the model\'s variable ops back into presetVars', () => {
    const plan = planPresetRequest(request(), nativeDefaultPreset('default'))
    expect(plan.request).not.toHaveProperty('preset')
    expect(plan.request).not.toHaveProperty('logFrom')
    expect(Object.keys(plan.request.schema.schema.properties as object).at(-1)).toBe('vars')
    expect(plan.request.system).toBe('PERSONA\n\nRULES')

    const reply: Record<string, unknown> = { lines: [], vars: [{ name: 'trust', op: 'add', value: '2' }, { name: '', op: 'set', value: 'x' }] }
    const warnings = finishPresetReply(reply, plan.applied)
    expect(reply).not.toHaveProperty('vars')
    expect(reply.presetVars).toEqual({ mood: 'wary', trust: '2' })
    expect(warnings).toHaveLength(1)
  })

  it('sends the preset\'s samplers only as bounded wire values', () => {
    const preset = { ...nativeDefaultPreset('default'), sampling: { temperature: 0.7, topK: 40, topP: 9 } }
    expect(planPresetRequest(request(), preset).sampling).toEqual({ temperature: 0.7, top_k: 40 })
  })
})

describe('the preset library', () => {
  it('creates Default in an empty store and moves an active id that names nothing', () => {
    const fresh = repairedLibrary([], null)
    expect(fresh.presets).toHaveLength(1)
    expect(fresh.active).toBe(fresh.presets[0].id)
    const other = toPresetFile({ ...nativeDefaultPreset('b'), name: 'B' })
    expect(repairedLibrary([other], 'gone').active).toBe('b')
  })

  it('refuses to delete the last preset and moves the active one when it is deleted', () => {
    const a = toPresetFile({ ...nativeDefaultPreset('a'), name: 'A' })
    const b = toPresetFile({ ...nativeDefaultPreset('b'), name: 'B' })
    expect(() => withoutPreset({ active: 'a', presets: [a] }, 'a')).toThrow()
    const next = withoutPreset({ active: 'a', presets: [a, b] }, 'a')
    expect(next.active).toBe('b')
    expect(listingOf(next).presets.map((p) => p.id)).toEqual(['b'])
  })
})
