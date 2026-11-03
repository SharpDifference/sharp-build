import { afterEach, expect, it, vi } from 'vitest'
import { character } from './fixtures'
import { appError } from '../src/shared/errors'
import { cancelGroup } from '../src/shared/jobQueue'

const mocks = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('../src/main/services/comfyService', () => ({ start: async () => {} }))
vi.mock('../src/main/services/localPhotoService', () => ({
  generatePhoto: mocks.generate,
  validatePhotoOverrides: () => {},
  carryPhotos: vi.fn(), photoInfo: vi.fn(), dropPhoto: vi.fn(), retirePhoto: vi.fn(),
  generateDuoPhoto: vi.fn(), photoLanded: vi.fn(), readPhotoBytes: vi.fn(),
  reservePhotoName: vi.fn(), storeWebpPhoto: vi.fn()
}))
const { registerPhotoIpc } = await import('../src/main/photoIpc')
const girl = character({ charId: 'photo-cancel-test' })
afterEach(async () => { await cancelGroup(girl.charId) })

it('cancels one early render without cancelling the same photo name in another playthrough', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  registerPhotoIpc((channel, handler) => { handlers.set(channel, handler as never) })
  const file = 'sarah_chat_001.png'
  let firstSignal: AbortSignal | undefined
  mocks.generate.mockImplementation(async (
    id: string, _character: unknown, _tier: unknown, _scene: unknown, _file: unknown,
    options: { signal: AbortSignal }
  ) => {
    if (id === '2') {
      expect(options.signal.aborted).toBe(false)
      return file
    }
    firstSignal = options.signal
    await new Promise<void>((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(appError('CANCELLED', 'Cancelled.')))
    })
    return file
  })
  const generate = handlers.get('comfy:generatePhoto')!
  const first = generate(null, '1', girl, 'everyday', 'At the cafe', file) as Promise<string>
  const failed = expect(first).rejects.toMatchObject({ code: 'CANCELLED' })
  await vi.waitFor(() => expect(firstSignal).toBeDefined())
  const second = generate(null, '2', girl, 'everyday', 'In her room', file) as Promise<string>
  await handlers.get('comfy:dropPhoto')!(null, '1', girl.charId, file, { cancelOnly: true })
  await failed
  expect(firstSignal!.aborted).toBe(true)
  await expect(second).resolves.toBe(file)
})
