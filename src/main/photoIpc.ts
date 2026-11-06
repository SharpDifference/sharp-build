import './localPhotoBackup'
import { registerImagePromptDraft } from '@vx/modkit/shared'
import { registerPhotoDraft } from '../shared/modEntries/photo-feature'
import type { IpcMainInvokeEvent } from 'electron'
import type { PhotoRenderOptions } from '../shared/photoTypes'
import { appError, type Character } from '@vx/modkit/shared'
import {
  carryPhotos,
  retirePhoto,
  photoInfo,
  dropPhoto,
  generateDuoPhoto,
  generatePhoto,
  photoLanded,
  readPhotoBytes,
  reservePhotoName,
  storeWebpPhoto,
  validatePhotoOverrides
} from './services/localPhotoService'

/**
 * The three channels the photo feature adds, registered from here rather than written into
 * `ipc.ts`: that file is handed this module's `registerPhotoIpc` and its own `handle`, so the
 * hook it carries is an import and a call.
 */

interface PhotoRender {
  controller: AbortController
  settled: Promise<string>
}
const renders = new Map<string, PhotoRender>()

/** Identifies a reserved picture within its playthrough and character folder. */
function renderKey(playthroughId: string, charId: string, file: string): string {
  return `${playthroughId}/${charId}/${file}`
}

/** Aborts one reserved picture's render and waits for its file cleanup. */
async function cancelPhoto(playthroughId: string, charId: string, file: string): Promise<void> {
  const render = renders.get(renderKey(playthroughId, charId, file))
  if (!render) return
  render.controller.abort()
  await render.settled.catch(() => {})
}

/** Calls the kit directly; each reserved picture owns its signal and window progress. */
function runPhoto(
  event: IpcMainInvokeEvent,
  playthroughId: string,
  charId: string,
  file: string,
  run: (options: { signal: AbortSignal; onProgress: (step: string) => void }) => Promise<string>
): Promise<string> {
  const key = renderKey(playthroughId, charId, file)
  const previous = renders.get(key)
  previous?.controller.abort()
  const controller = new AbortController()
  const jobId = `photo:${key}`
  const report = (status: 'running' | 'done' | 'error', step: string): void => {
    try {
      if (!event.sender.isDestroyed()) {
        event.sender.send('jobs:progress', {
          jobId, group: charId, key: `photo:${playthroughId}:${file}`, status, step
        })
      }
    } catch (error) {
      console.warn('[photo] could not report render progress:', error)
    }
  }
  const render: PhotoRender = { controller, settled: Promise.resolve('') }
  renders.set(key, render)
  render.settled = (async () => {
    try {
      // A repeated request for this file cannot outpace the cancelled writer's cleanup.
      await previous?.settled.catch(() => {})
      if (controller.signal.aborted) throw appError('CANCELLED', 'Generation was cancelled.')
      const result = await run({
        signal: controller.signal,
        onProgress: (step) => report('running', step)
      })
      report('done', 'Done')
      return result
    } catch (error) {
      report('error', controller.signal.aborted ? 'Cancelled' : 'Failed')
      throw error
    } finally {
      if (renders.get(key) === render) renders.delete(key)
    }
  })()
  return render.settled
}

/** How `ipc.ts` wraps a listener into its own `Result` envelope. */
type Handle = <Args extends unknown[], T>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
) => void

/** Registers the photo channels. Called from `registerIpcHandlers` with its own `handle`. */
export function registerPhotoIpc(handle: Handle): void {
  registerPhotoDraft(registerImagePromptDraft)
  // Reserves the name the waiting bubble will carry into the save.
  handle(
    'comfy:reservePhotoName',
    (_event, playthroughId: string, character: Character, kind: string, inSave: unknown) =>
      reservePhotoName(playthroughId, character, kind, inSave)
  )

  // The pictures a continued semester's carried threads and feeds point at, copied across.
  handle(
    'comfy:carryPhotos',
    (_event, fromPlaythroughId: string, toPlaythroughId: string, charIds?: string[]) =>
      carryPhotos(fromPlaythroughId, toPlaythroughId, charIds)
  )

  // Finds a picture that landed after its waiting bubble was saved.
  handle('comfy:photoLanded', (_event, playthroughId: string, charId: string, file: string) =>
    photoLanded(playthroughId, charId, file)
  )

  // A picture that just landed as PNG, read back for the renderer to encode as WebP.
  handle('comfy:readPhoto', (_event, playthroughId: string, charId: string, file: string) =>
    readPhotoBytes(playthroughId, charId, file)
  )

  // The WebP the renderer encoded from a picture that just landed as PNG.
  handle(
    'comfy:storeWebpPhoto',
    (_event, playthroughId: string, charId: string, file: string, bytes: Uint8Array) =>
      storeWebpPhoto(playthroughId, charId, file, bytes)
  )

  // Reads the recorded request, or rebuilds it from today's tags and settings.
  handle(
    'comfy:photoInfo',
    (
      _event,
      playthroughId: string,
      character: Character,
      friend: Character | undefined,
      tier: string,
      scene: string,
      file: string,
      rebuild: boolean = false
    ) => photoInfo(playthroughId, character, friend, tier, scene, file, rebuild)
  )

  // Cancels an abandoned render, or removes a file once saved references permit it.
  handle(
    'comfy:dropPhoto',
    async (
      _event,
      playthroughId: string,
      charId: string,
      file: string,
      options?: { cancelOnly?: boolean; replacement?: string }
    ) => {
      await cancelPhoto(playthroughId, charId, file)
      if (options?.cancelOnly) return
      if (options?.replacement) return retirePhoto(playthroughId, charId, file, options.replacement)
      return dropPhoto(playthroughId, charId, file)
    }
  )

  // One picture she texted, rendered after her words have already landed on the thread.
  handle(
    'comfy:generatePhoto',
    (
      event,
      playthroughId: string,
      character: Character,
      tier: string,
      photoPrompt: string,
      file: string,
      overrides: PhotoRenderOptions = {}
    ) => {
      validatePhotoOverrides(overrides, false)
      return runPhoto(event, playthroughId, character.charId, file, (options) =>
        generatePhoto(playthroughId, character, tier, photoPrompt, file, options, overrides)
      )
    }
  )

  // A picture of her and a friend, queued under her: it is hers, and lands in her folder.
  handle(
    'comfy:generateDuoPhoto',
    (
      event,
      playthroughId: string,
      character: Character,
      friend: Character,
      tier: string,
      photoPrompt: string,
      file: string,
      overrides: PhotoRenderOptions = {}
    ) => {
      validatePhotoOverrides(overrides, true)
      return runPhoto(event, playthroughId, character.charId, file, (options) =>
        generateDuoPhoto(
          playthroughId,
          character,
          friend,
          tier,
          photoPrompt,
          file,
          options,
          overrides
        )
      )
    }
  )
}
