import { nativeImage } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { ECHO_ART_ID, echoImagePrompt, echoLocalImagePrompt, normalizeEchoIdentity, type EchoArtRequest } from '@shared/echo'
import { generateImage } from '@shared/llm/cloudImage'
import { getDataPath } from '../paths'
import { modOn, optionOn } from '@shared/mods'
import { getModSwitches } from './modsService'
import { clearEchoMatte } from './echoMatte'
import { generateLocalEcho } from './echoLocalImage'
import { cutoutEchoImage, prepareEchoCutout } from './echoCutout'

const jobs = new Map<string, { owner: number; controller: AbortController }>()
const folder = (): string => join(getDataPath(),'echoes','art')
const MAX_BYTES = 20 * 1024 * 1024
function artPath(id: string): string {
  if (typeof id !== 'string' || !ECHO_ART_ID.test(id)) throw Error('Invalid Echo artwork id.')
  return join(folder(),`${id}.png`)
}
function decodeArt(bytes: Uint8Array): Electron.NativeImage {
  if (bytes.byteLength > MAX_BYTES) throw Error('Choose an image smaller than 20 MB.')
  let image = nativeImage.createFromBuffer(Buffer.from(bytes))
  if (image.isEmpty()) throw Error('This file is not a readable image. Use PNG, JPEG or WebP.')
  const size = image.getSize()
  if (size.width * size.height > 25_000_000) throw Error('Choose an image smaller than 25 megapixels.')
  if (Math.max(size.width,size.height) > 1536) image = image.resize(size.height >= size.width ? {height:1536} : {width:1536})
  return image
}
/** An immutable file id lets old saves keep their original artwork after a replacement. */
async function storeArt(bytes: Uint8Array): Promise<string> {
  const image = decodeArt(bytes)
  const id = randomUUID()
  await mkdir(folder(),{recursive:true})
  await writeFile(artPath(id),image.toPNG(),{flag:'wx'})
  return id
}
export async function generateEchoArt(value: EchoArtRequest, owner: number): Promise<string> {
  const identity = normalizeEchoIdentity(value?.identity)
  if (!identity?.name || !ECHO_ART_ID.test(value?.requestId ?? '') || typeof value.name !== 'string' || typeof value.bio !== 'string' || (value.backstory !== undefined && typeof value.backstory !== 'string')) throw Error('Invalid Echo request.')
  const switches = await getModSwitches()
  if (!modOn(switches,'echo')) throw Error('Enable Echo in Mods first.')
  if (jobs.size) throw Error('An Echo image is already being generated. Wait or cancel it first.')
  const controller = new AbortController()
  jobs.set(value.requestId,{owner,controller})
  try {
    const local = optionOn(switches,'echo','megaten-art')
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(local ? 900000 : 600000)])
    const prompt = (local ? echoLocalImagePrompt : echoImagePrompt)({...value,identity})
    if (local) {
      const bytes = await generateLocalEcho(prompt,signal)
      signal.throwIfAborted()
      return await storeArt(bytes)
    }
    await prepareEchoCutout(signal)
    const bytes = await generateImage(prompt,{aspectRatio:'3:4',signal})
    signal.throwIfAborted()
    const png = decodeArt(bytes).toPNG()
    const sourceFolder = join(getDataPath(),'echoes','sources')
    const sourceId = randomUUID()
    await mkdir(sourceFolder,{recursive:true})
    await writeFile(join(sourceFolder,`${sourceId}.png`),png,{flag:'wx'})
    try {
      const cutout = await cutoutEchoImage(png,signal)
      signal.throwIfAborted()
      return await storeArt(cutout)
    } catch (error) {
      signal.throwIfAborted()
      throw new Error(`Echo background removal failed. Your previous artwork is unchanged. The original image is kept in data/echoes/sources/${sourceId}.png; no automatic paid retry was made.`,{cause:error})
    }
  } finally { jobs.delete(value.requestId) }
}
export function cancelEchoArt(id: string, owner: number): null {
  const job = jobs.get(id)
  if (job?.owner === owner) job.controller.abort()
  return null
}
export async function uploadEchoArt(path: string): Promise<string> {
  if (!modOn(await getModSwitches(),'echo')) throw Error('Enable Echo in Mods first.')
  if ((await stat(path)).size > MAX_BYTES) throw Error('Choose an image smaller than 20 MB.')
  return storeArt(await readFile(path))
}
export async function readEchoArt(id: string, generated = false): Promise<string | null> {
  if (typeof generated !== 'boolean') throw Error('Invalid Echo artwork source.')
  const path = artPath(id)
  try {
    const bytes = await readFile(path)
    if (bytes.byteLength > MAX_BYTES) throw Error('Echo artwork is too large.')
    if (generated) {
      const image = nativeImage.createFromBuffer(bytes),size = image.getSize()
      if (size.width * size.height > 25_000_000) throw Error('Echo artwork is too large.')
      if (!image.isEmpty()) {
        const cleaned = clearEchoMatte(image.toBitmap(),size.width,size.height)
        if (cleaned.cleared || cleaned.feathered) {
          const preview = nativeImage.createFromBitmap(Buffer.from(cleaned.bitmap),size).toPNG()
          return `data:image/png;base64,${preview.toString('base64')}`
        }
      }
    }
    return `data:image/png;base64,${bytes.toString('base64')}`
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
