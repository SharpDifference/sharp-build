import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ exec: vi.fn(), stat: vi.fn(), write: vi.fn(), read: vi.fn(), rm: vi.fn(), mkdir: vi.fn() }))
vi.mock('child_process', () => ({ execFile: mocks.exec }))
vi.mock('fs/promises', () => ({ stat: mocks.stat, writeFile: mocks.write, readFile: mocks.read, rm: mocks.rm, mkdir: mocks.mkdir }))
vi.mock('../src/main/paths', () => ({ getComfyPythonPath: () => 'python.exe', getComfyUiPath: () => 'comfy', getTempPath: () => 'tmp', getWorkflowPath: (name: string) => `assets/workflows/${name}` }))
import { cutoutEchoImage, prepareEchoCutout } from '../src/main/services/echoCutout'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.stat.mockResolvedValue({ isFile: () => true })
  mocks.read.mockResolvedValue(Buffer.from('cutout'))
  mocks.exec.mockImplementation((_exe, _args, _options, callback) => callback(null))
})
it('checks the installed remover without diffusion models or automatic downloads', async () => {
  const signal = new AbortController().signal
  await prepareEchoCutout(signal)
  expect(mocks.exec.mock.calls[0][1]).toContain('--check')
  expect(mocks.exec.mock.calls[0][2]).toMatchObject({ signal, windowsHide: true, timeout: 180000 })
  expect(JSON.stringify(mocks.stat.mock.calls)).not.toMatch(/safetensors|loras/)
})
it('cleans job-owned scratch files on success and failure', async () => {
  const signal = new AbortController().signal
  await expect(cutoutEchoImage(Buffer.from('png'), signal)).resolves.toEqual(Buffer.from('cutout'))
  expect(mocks.rm).toHaveBeenCalledTimes(2)
  mocks.exec.mockImplementation((_exe, _args, _options, callback) => callback(Error('failed')))
  await expect(cutoutEchoImage(Buffer.from('png'), signal)).rejects.toThrow('failed')
  expect(mocks.rm).toHaveBeenCalledTimes(4)
  expect(new Set(mocks.rm.mock.calls.map(call => call[0])).size).toBe(4)
})
it('preserves cancellation instead of suggesting an installation error', async () => {
  const controller = new AbortController(); controller.abort()
  await expect(prepareEchoCutout(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  await expect(cutoutEchoImage(Buffer.from('png'), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.exec).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})
