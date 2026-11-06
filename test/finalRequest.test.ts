import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StructuredRequest } from '../src/shared/types'

/**
 * A mod's final request: one tagged owner rewrites a scene call and reads its reply, a hook that
 * fails leaves the call as built, and the fields only the app reads never reach the provider.
 */

const sent = vi.hoisted(() => ({
  complete: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ lines: [] }))
}))
vi.mock('@shared/llm/cloudLlm', async (original) => ({
  ...(await original<typeof import('../src/shared/llm/cloudLlm')>()),
  completeStructured: sent.complete
}))

const { setSharedModRules } = await import('../packages/modkit/src/shared/modRules')
const { registerFinalRequest, registerRequestSender, completeWithFinalRequest } = await import('../src/main/services/finalRequest')
const { withoutLocalFields } = await import('../src/shared/llm/cloudLlm')

const asked = {
  system: 's',
  user: 'u',
  schema: { name: 'scene' },
  modTags: { 'fr-b': 1, 'fr-a': 2, 'fr-off': 3 }
} as unknown as StructuredRequest
const rewritten = { ...asked, user: 'rewritten' } as StructuredRequest

beforeEach(() => {
  sent.complete.mockClear()
  setSharedModRules((id) => id !== 'fr-off')
})

describe('the final request of a tagged scene call', () => {
  it('goes to the first enabled tagged owner by id alone, with its sampling, and its finish lands on modReply', async () => {
    const owned: string[] = []
    const stops = [
      registerFinalRequest('fr-a', (_request, { tag }) => {
        owned.push(`a:${tag}`)
        return { request: rewritten, sampling: { temperature: 0.5 }, finish: () => ({ read: true }) }
      }),
      registerFinalRequest('fr-b', () => (owned.push('b'), null)),
      registerFinalRequest('fr-off', () => (owned.push('off'), null))
    ]
    sent.complete.mockResolvedValueOnce({ lines: [] })

    const reply = (await completeWithFinalRequest<Record<string, unknown>>(asked)) as Record<string, unknown>

    expect(owned).toEqual(['a:2'])
    expect(sent.complete.mock.calls[0][0]).toBe(rewritten)
    expect(sent.complete.mock.calls[0][4]).toEqual({ temperature: 0.5 })
    expect(reply.modReply).toEqual({ 'fr-a': { read: true } })
    stops.forEach((stop) => stop())
  })

  it('goes as built when the owner throws or has no plan', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const stopA = registerFinalRequest('fr-a', () => {
      throw Error('broken')
    })
    await completeWithFinalRequest(asked)
    stopA()
    const stopB = registerFinalRequest('fr-b', () => null)
    await completeWithFinalRequest({ ...asked, modTags: { 'fr-b': 1 } } as StructuredRequest)
    stopB()

    expect(sent.complete.mock.calls.map((call) => call[0])).toEqual([asked, { ...asked, modTags: { 'fr-b': 1 } }])
    warn.mockRestore()
  })

  it('strips the parts, the scene spot and the tags before a request reaches a provider', () => {
    const clean = withoutLocalFields({
      ...asked,
      parts: [],
      sceneSpot: { spot: 'opening', cast: [] }
    } as unknown as StructuredRequest)
    expect(clean).toEqual({ system: 's', user: 'u', schema: { name: 'scene' } })
  })
})

describe('the request sender of a tagged scene call', () => {
  it('is handed the reshaped request and its wire sampling, replaces the send, and the finish reads its reply', async () => {
    const seen: unknown[] = []
    const stops = [
      registerFinalRequest('fr-a', () => ({
        request: rewritten,
        sampling: { temperature: 0.5 },
        finish: () => ({ read: true })
      })),
      registerRequestSender('fr-a', async (request, ctx) => {
        seen.push(request, ctx.tag, ctx.sampling)
        return { reply: { lines: ['sent'] } }
      })
    ]

    const reply = (await completeWithFinalRequest<Record<string, unknown>>(asked)) as Record<string, unknown>

    expect(seen).toEqual([rewritten, 2, { temperature: 0.5 }])
    expect(sent.complete).not.toHaveBeenCalled()
    expect(reply).toEqual({ lines: ['sent'], modReply: { 'fr-a': { read: true } } })
    stops.forEach((stop) => stop())
  })

  it('leaves the call as built when the sender declines', async () => {
    const stop = registerRequestSender('fr-a', async () => null)
    await completeWithFinalRequest(asked)
    stop()

    expect(sent.complete.mock.calls[0][0]).toBe(asked)
  })

  it('fails the call when the sender throws', async () => {
    const stop = registerRequestSender('fr-a', async () => {
      throw Error('refused')
    })
    await expect(completeWithFinalRequest(asked)).rejects.toThrow('refused')
    stop()
  })

  it('runs only the first enabled tagged sender by id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ran: string[] = []
    const stops = ['fr-a', 'fr-b', 'fr-off'].map((id) =>
      registerRequestSender(id, async () => (ran.push(id), { reply: {} }))
    )
    await completeWithFinalRequest(asked)
    stops.forEach((stop) => stop())

    expect(ran).toEqual(['fr-a'])
    warn.mockRestore()
  })
})
