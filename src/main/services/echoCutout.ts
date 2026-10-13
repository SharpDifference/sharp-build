import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { getComfyPythonPath, getComfyUiPath, getTempPath, getWorkflowPath } from '../paths'

const script = (): string => getWorkflowPath('echoCutout.py')
const model = (): string => join(getComfyUiPath(), '.transparent-background', 'ckpt_base.pth')

/** Uses only the installed segmentation model, never a diffusion checkpoint or LoRA. */
async function run(args: string[], signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    execFile(getComfyPythonPath(), ['-s', script(), '--model', model(), ...args], {
      signal, windowsHide: true, timeout: 180_000, maxBuffer: 256 * 1024,
      env: { ...process.env, TRANSPARENT_BACKGROUND_FILE_PATH: getComfyUiPath(), NO_ALBUMENTATIONS_UPDATE: '1' }
    }, error => error ? reject(error) : resolve())
  })
  signal.throwIfAborted()
}

/** Check dependencies before asking a paid image provider for artwork. */
export async function prepareEchoCutout(signal: AbortSignal): Promise<void> {
  try {
    for (const path of [getComfyPythonPath(), model(), script()]) {
      if (!(await stat(path)).isFile()) throw Error('Missing cutout dependency')
    }
    await run(['--check'], signal)
  } catch (error) {
    signal.throwIfAborted()
    throw new Error('Echo background removal needs the installed ComfyUI Python runtime, transparent-background package and background-removal model. No image API request was made.', { cause: error })
  }
}

/** Input is a bounded, decoded PNG. All temporary files belong to this single job. */
export async function cutoutEchoImage(png: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted()
  await mkdir(getTempPath(), { recursive: true })
  const input = join(getTempPath(), `echo-cutout-${randomUUID()}.png`)
  const output = `${input}.cutout.png`
  try {
    await writeFile(input, png, { flag: 'wx' })
    await run(['--input', input, '--output', output], signal)
    return await readFile(output)
  } finally {
    await Promise.all([rm(input, { force: true }), rm(output, { force: true })])
  }
}
