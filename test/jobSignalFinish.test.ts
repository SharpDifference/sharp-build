import { expect, it } from 'vitest'
import { cancelGroup, cancelKeys, enqueue, setProgressSink } from '../src/shared/jobQueue'

it.each(['group', 'keys'] as const)('keeps a completed game job done on a late %s cancellation', async method => {
  const statuses: string[] = []
  setProgressSink(step => statuses.push(step.status))
  let cancelling: Promise<void> | undefined
  try {
    const result = await enqueue({ group: 'finished-game', key: 'sprite', run: async () => {
      queueMicrotask(() => { cancelling = method === 'group' ? cancelGroup('finished-game') : cancelKeys('finished-game', ['sprite']) })
      return 'written'
    } })
    await cancelling
    expect(result).toBe('written')
    expect(statuses.at(-1)).toBe('done')
  } finally { setProgressSink(() => {}) }
})

it('keeps per-job cancellation authoritative over a late finish', async () => {
  const controller = new AbortController()
  await expect(enqueue({ group: 'finished-mod', signal: controller.signal, run: async () => {
    queueMicrotask(() => controller.abort())
    return 'written'
  } })).rejects.toMatchObject({ code: 'CANCELLED' })
})
