import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEcho, echoImagePrompt } from '@shared/echo'
import { NO_SWITCHES, optionOn } from '@shared/mods'

const mocks = vi.hoisted(() => ({
  switches: vi.fn(), cloud: vi.fn(), local: vi.fn(), prepare: vi.fn(), cutout: vi.fn(),
  mkdir: vi.fn(), write: vi.fn(), read: vi.fn(), stat: vi.fn(), matte: vi.fn()
}))
vi.mock('../src/main/services/modsService', () => ({ getModSwitches: mocks.switches }))
vi.mock('@shared/llm/cloudImage', () => ({ generateImage: mocks.cloud }))
vi.mock('../src/main/services/echoLocalImage', () => ({ generateLocalEcho: mocks.local }))
vi.mock('../src/main/services/echoCutout', () => ({ prepareEchoCutout: mocks.prepare, cutoutEchoImage: mocks.cutout }))
vi.mock('../src/main/services/echoMatte', () => ({ clearEchoMatte: mocks.matte }))
vi.mock('../src/main/paths', () => ({ getDataPath: () => 'echo-test-data' }))
vi.mock('fs/promises', () => ({ mkdir: mocks.mkdir, writeFile: mocks.write, readFile: mocks.read, stat: mocks.stat }))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer: (bytes: Buffer) => ({
  isEmpty: () => false, getSize: () => ({ width: 768, height: 1024 }), toPNG: () => bytes
}) } }))

import { cancelEchoArt, generateEchoArt, uploadEchoArt } from '../src/main/services/echoService'
const request = () => ({ requestId: 'fdc99b1a-bd3b-41ca-897f-757b3bf983c3',
  identity: normalizeEcho({ player: { name: 'Vaelum', aspect: 'veilkeeper', motif: 0 } }).player!,
  name: 'Test owner', bio: 'Curious and thoughtful.' })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.switches.mockResolvedValue(NO_SWITCHES)
  mocks.cloud.mockResolvedValue(Buffer.from('original'))
  mocks.cutout.mockResolvedValue(Buffer.from('transparent'))
  mocks.local.mockResolvedValue(Buffer.from('local-transparent'))
  mocks.read.mockResolvedValue(Buffer.from('uploaded'))
  mocks.stat.mockResolvedValue({ size: 10 })
})

describe('Echo artwork routing and safe background removal', () => {
  it('defaults to the cloud and asks for a clean white backdrop without a dark aura', async () => {
    expect(optionOn(NO_SWITCHES, 'echo', 'megaten-art')).toBe(false)
    const prompt = echoImagePrompt(request())
    expect(prompt).toContain('plain white background')
    expect(prompt).toContain('do not surround it with a black halo')
    expect(prompt).not.toContain('ethereal aura')
    await generateEchoArt(request(), 7)
    expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.cloud.mock.invocationCallOrder[0])
    expect(mocks.write.mock.calls[0][0]).toMatch(/echoes[/\\]sources[/\\]/)
    expect(mocks.write.mock.calls[0][1]).toEqual(Buffer.from('original'))
    expect(mocks.write.mock.calls[1][0]).toMatch(/echoes[/\\]art[/\\]/)
    expect(mocks.write.mock.calls[1][1]).toEqual(Buffer.from('transparent'))
    expect(mocks.write.mock.invocationCallOrder[0]).toBeLessThan(mocks.cutout.mock.invocationCallOrder[0])
    expect(mocks.local).not.toHaveBeenCalled()
    expect(mocks.matte).not.toHaveBeenCalled()
  })
  it('refuses a missing remover before spending an API call, then releases the job', async () => {
    mocks.prepare.mockRejectedValueOnce(Error('missing remover'))
    await expect(generateEchoArt(request(), 7)).rejects.toThrow('missing remover')
    expect(mocks.cloud).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
    await expect(generateEchoArt(request(), 7)).resolves.toBeTypeOf('string')
  })
  it('keeps the paid original if cleanup fails, without replacing art or retrying the API', async () => {
    mocks.cutout.mockRejectedValue(Error('segmentation failed'))
    await expect(generateEchoArt(request(), 7)).rejects.toThrow('original image is kept')
    expect(mocks.cloud).toHaveBeenCalledTimes(1)
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.write.mock.calls[0][0]).toMatch(/sources/)
  })
  it('cancels cleanup only for the request owner and does not publish canceled art', async () => {
    mocks.cutout.mockImplementation(async (_png: Uint8Array, signal: AbortSignal) => {
      cancelEchoArt(request().requestId, 8)
      expect(signal.aborted).toBe(false)
      cancelEchoArt(request().requestId, 7)
      signal.throwIfAborted()
    })
    await expect(generateEchoArt(request(), 7)).rejects.toThrow()
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.cloud).toHaveBeenCalledTimes(1)
  })
  it('keeps explicit local selection and uploads independent of cloud cleanup', async () => {
    mocks.switches.mockResolvedValue({ on: {}, options: { 'echo:megaten-art': true } })
    await generateEchoArt(request(), 7)
    await uploadEchoArt('chosen.png')
    expect(mocks.local).toHaveBeenCalledTimes(1)
    expect(mocks.cloud).not.toHaveBeenCalled()
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.cutout).not.toHaveBeenCalled()
    expect(mocks.write.mock.calls.map(call => call[1])).toEqual([Buffer.from('local-transparent'), Buffer.from('uploaded')])
  })
})
