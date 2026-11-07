import { protocol } from 'electron'
import { SAFE_CHAR_ID, SAFE_NUMERIC_ID, imageTypeOf } from '@vx/modkit/shared'
import { isPhotoFile } from '../shared/photoFiles'
import { readPhotoImage } from './photoFiles'

const SCHEME = 'playimg'

export { getPhotoPath, getPhotosPath, getPhotosRoot } from './photoFiles'

/**
 * This scheme's entry for `registerImageSchemes`, which is the only place a scheme may be
 * privileged: Electron takes one such registration and a second replaces the first, so this is
 * handed to that call rather than registered on its own.
 */
export const PHOTO_SCHEME: Electron.CustomScheme = {
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}

/** Must run **after** `app.whenReady()`. Serves one save's photo folder and nothing else. */
export function handlePhotoProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    // The host is a constant (see `photoUrl`); the path carries all three parts.
    const [playthroughId, charId, file, ...rest] = decodeURIComponent(url.pathname)
      .replace(/^\//, '')
      .split('/')

    // Every part is checked against its own vocabulary: an id that could climb out of the
    // folder never reaches the filesystem, and nothing but a photo is served.
    if (
      rest.length > 0 ||
      !SAFE_NUMERIC_ID.test(playthroughId ?? '') ||
      !SAFE_CHAR_ID.test(charId ?? '') ||
      !isPhotoFile(file ?? '')
    ) {
      console.warn(`[playimg] refused ${request.url}`)
      return new Response('Not found', { status: 404 })
    }

    // A WebP the renderer has not encoded yet, or never did, is served from its PNG.
    try {
      const bytes = await readPhotoImage(playthroughId, charId, file)
      return new Response(bytes as BodyInit, {
        headers: { 'Content-Type': imageTypeOf(bytes) ?? 'application/octet-stream' }
      })
    } catch (err) {
      console.warn(`[playimg] ${playthroughId}/${charId}/${file}: ${String(err)}`)
      return new Response('Not found', { status: 404 })
    }
  })
}
