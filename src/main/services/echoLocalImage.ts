import { randomInt, randomUUID } from 'crypto'
import { readFile, rm, stat } from 'fs/promises'
import { join } from 'path'
import { getComfyModelFilePath, getComfyPythonPath, getTempPath } from '../paths'
import { runGenerationJob, start } from './comfyService'

/** Isolated graph: never changes portrait/photo workflows or cloud settings. */
export async function generateLocalEcho(prompt: string, signal: AbortSignal): Promise<Uint8Array> {
  for (const path of [getComfyPythonPath(),getComfyModelFilePath('checkpoints','novaAnimeXL_ilV190.safetensors'),getComfyModelFilePath('loras','Megaten_Style.safetensors')]) {
    try { await stat(path) } catch { throw Error('Echo local artwork needs ComfyUI, the Nova Anime XL checkpoint and Megaten Style LoRA. Use Install local art models in Echoes after setting up ComfyUI, or select Gemini / image API.') }
  }
  signal.throwIfAborted()
  await start()
  signal.throwIfAborted()
  const destPath = join(getTempPath(),`echo-${randomUUID()}.png`)
  try {
    await runGenerationJob({workflowFile:'echoMegaten.json',nodes:{seed:'7',positivePrompt:'4',saveImage:'9'},
      prompts:{positive:`kazuma_kaneko_(style), masterpiece, best quality, solo fantasy creature, full body, plain white background, well-lit opaque body, colored surfaces, balanced midtones, soft fill light, readable shadow details, restrained dark accents, visible surface details, ${prompt}`,negative:'(text, lettering, typography, words, letters, numbers, captions, labels, annotations, speech bubble, watermark, signature, logo:1.4), character sheet, reference sheet, infographic, diagram, border, frame, scenery, black background, silhouette, underexposed, crushed blacks, featureless black body, monochrome, invisible body, rim lighting only, checkerboard, chibi, plush toy, cropped, out of frame, human, person'},
      seed:randomInt(0,2147483647),destPath,label:'Echo artwork',logContext:'Echo-only Megaten LoRA'
    },{signal})
    signal.throwIfAborted()
    return await readFile(destPath)
  } finally {
    await rm(destPath,{force:true})
    await rm(`${destPath}.partial`,{force:true})
  }
}
