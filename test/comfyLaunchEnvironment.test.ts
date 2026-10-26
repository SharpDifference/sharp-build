import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  comfyLaunchEnvironment, registerComfyLaunchEnvironment, type ComfyLaunchContext
} from '../src/main/services/comfyLaunchEnvironment'

const context: ComfyLaunchContext = { root: 'C:/fixture/comfy', platform: 'win32' }
const disposers: (() => void)[] = []
function register(...args: Parameters<typeof registerComfyLaunchEnvironment>): () => void {
  const dispose = registerComfyLaunchEnvironment(...args)
  disposers.push(dispose)
  return dispose
}
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()) })

describe('managed ComfyUI launch environment', () => {
  it('leaves native inheritance alone without an answer', () => {
    expect(comfyLaunchEnvironment(context)).toBeUndefined()
    register('absent', () => null)
    register('empty', () => ({}))
    expect(comfyLaunchEnvironment(context)).toBeUndefined()
  })

  it('passes a frozen root/platform snapshot and overrides only the child environment', () => {
    const inherited = Object.freeze({ Path: 'native path', KEEP: 'kept', CACHE: 'old' })
    const parentCache = process.env.CACHE
    const input = { ...context }
    const provider = vi.fn((ctx: Readonly<ComfyLaunchContext>) => {
      expect(Object.isFrozen(ctx)).toBe(true)
      expect(ctx).not.toBe(input)
      return { CACHE: ctx.root }
    })
    register('fixture', provider)
    const result = comfyLaunchEnvironment(input, inherited)
    expect(provider).toHaveBeenCalledWith(context)
    expect(result).toEqual({ Path: 'native path', KEEP: 'kept', CACHE: context.root })
    expect(inherited.CACHE).toBe('old')
    expect(input).toEqual(context)
    expect(process.env.CACHE === parentCache).toBe(true)
  })

  it.each([false, true])('combines distinct keys and equal answers independently of registration order=%s', reverse => {
    const entries = [
      ['alpha', () => ({ CACHE: 'same', ALPHA: 'a' })],
      ['beta', () => ({ cache: 'same', BETA: 'b' })]
    ] as const
    for (const [id, provider] of reverse ? [...entries].reverse() : entries) register(id, provider)
    expect(comfyLaunchEnvironment(context, { KEEP: 'kept' }))
      .toEqual({ KEEP: 'kept', CACHE: 'same', ALPHA: 'a', BETA: 'b' })
  })

  it.each([false, true])('names both owners on a conflicting answer, independent of registration order=%s', reverse => {
    for (const id of reverse ? ['beta', 'alpha'] : ['alpha', 'beta']) {
      register(id, () => ({ CACHE: id + '-private-value' }))
    }
    expect(() => comfyLaunchEnvironment(context, {})).toThrowError(expect.objectContaining({
      code: 'COMFY_ENV_CONFLICT', message: 'ComfyUI could not start: alpha and beta disagree on CACHE.'
    }))
  })

  it('replaces inherited Windows key aliases while respecting case on other platforms', () => {
    register('fixture', () => ({ PATH: 'child path' }))
    const inherited = { Path: 'one', PATH: 'two' }
    expect(comfyLaunchEnvironment(context, inherited)).toEqual({ PATH: 'child path' })
    expect(comfyLaunchEnvironment({ ...context, platform: 'linux' }, inherited))
      .toEqual({ Path: 'one', PATH: 'child path' })
    expect(inherited).toEqual({ Path: 'one', PATH: 'two' })
  })

  it('removes the provider without changing data, and an old disposer cannot remove a replacement', () => {
    const provider = () => ({ CACHE: 'new' })
    const old = register('fixture', provider)
    old(); old()
    expect(comfyLaunchEnvironment(context)).toBeUndefined()
    register('fixture', provider)
    old()
    expect(comfyLaunchEnvironment(context, {})).toEqual({ CACHE: 'new' })
  })

  it('reads providers afresh for a later launch, including an explicit inactive answer', () => {
    let on = false
    register('fixture', ctx => on ? { CACHE: ctx.root } : null)
    expect(comfyLaunchEnvironment(context)).toBeUndefined()
    on = true
    expect(comfyLaunchEnvironment({ ...context, root: 'new-root' }, {})).toEqual({ CACHE: 'new-root' })
  })

  it('rejects duplicate owners instead of silently replacing their setup', () => {
    register('fixture', () => ({ CACHE: 'old' }))
    expect(() => register('fixture', () => ({ CACHE: 'new' }))).toThrow('already registered by fixture')
    expect(comfyLaunchEnvironment(context, {})).toEqual({ CACHE: 'old' })
  })

  it.each([{ 'BAD=NAME': 'x' }, { CACHE: 'nul\0value' }, { CACHE: 3 }, ['not a record'], undefined])(
    'rejects invalid environment entries before spawn: %j', value => {
      register('invalid', () => value as unknown as Record<string, string>)
      expect(() => comfyLaunchEnvironment(context)).toThrowError(expect.objectContaining({ code: 'COMFY_ENV_INVALID' }))
    }
  )

  it('reports a provider failure by owner without including its potentially private values', () => {
    register('broken', () => { throw Error('private value') })
    expect(() => comfyLaunchEnvironment(context)).toThrowError(expect.objectContaining({
      code: 'COMFY_ENV_PROVIDER', message: "ComfyUI could not start: broken's launch environment failed."
    }))
  })
})
