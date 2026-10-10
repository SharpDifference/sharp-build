import { copyFile, mkdir, readdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { appError, messageOf } from '@shared/errors'
import { assertEndingRequest, ENDING_PICTURE_SIZE, endingPicturePrompt } from '@shared/endingPicture'
import { generateImage } from '@shared/llm/cloudImage'
import { LINEUP_MIME_TYPE } from '@shared/lineup'
import { ENDING_IMAGE_MODEL_ID } from '@shared/providers'
import { SAFE_NUMERIC_ID } from '@shared/saveRules'
import { endingArtSemesterOf, getEndingArtPath, getPlaythroughPath } from '../paths'
import { assertSafePlaythroughId } from './saveService'

/**
 * The graduation picture: the reader's friends at a party, drawn once per semester of a
 * playthrough from a reference sheet of their sprites and kept in the playthrough folder.
 */

/** Refuses a semester id that could not name a picture's file. */
function assertSafeSemesterId(semesterId: string | undefined): void {
  if (semesterId !== undefined && !SAFE_NUMERIC_ID.test(semesterId)) {
    throw appError('SEMESTER_ID_INVALID', 'That semester id is not valid.', semesterId)
  }
}

/** The later semesters a playthrough folder holds a graduation picture for. */
export async function endingArtSemesters(playthroughId: string): Promise<string[]> {
  assertSafePlaythroughId(playthroughId)
  const entries = await readdir(getPlaythroughPath(playthroughId)).catch(() => [] as string[])
  return entries.flatMap((entry) => {
    const semesterId = endingArtSemesterOf(entry)
    return semesterId ? [semesterId] : []
  })
}

/**
 * Draws a semester's picture, writes it into the playthrough folder and answers with the same
 * bytes; `semesterId` is absent for the first semester.
 */
export async function generateEndingArt(
  playthroughId: string,
  sheet: string,
  friendCount: number,
  signal?: AbortSignal,
  semesterId?: string
): Promise<Buffer> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSemesterId(semesterId)
  const bytes = Buffer.from(sheet, 'base64')
  assertEndingRequest(friendCount, bytes)

  const art = Buffer.from(
    await generateImage(endingPicturePrompt(friendCount), {
      model: ENDING_IMAGE_MODEL_ID,
      imageSize: ENDING_PICTURE_SIZE,
      sources: [{ bytes, mimeType: LINEUP_MIME_TYPE }],
      signal
    })
  )

  // Last gate before the write: the `mkdir` below would recreate a playthrough folder that
  // was deleted while the picture was being drawn.
  if (signal?.aborted) throw appError('CANCELLED', 'Generation was cancelled.')

  // Atomic like every other write.
  const path = getEndingArtPath(playthroughId, semesterId)
  const temp = `${path}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temp, art)
    await rename(temp, path)
  } catch (err) {
    await unlink(temp).catch(() => {})
    throw appError(
      'ENDING_ART_UNWRITABLE',
      'Failed to generate CG.',
      messageOf(err)
    )
  }
  return art
}

/** A semester's picture already on disk, or `null` where there is none. */
export async function readEndingArt(
  playthroughId: string,
  semesterId?: string
): Promise<Buffer | null> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSemesterId(semesterId)
  try {
    return await readFile(getEndingArtPath(playthroughId, semesterId))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw appError(
      'ENDING_ART_UNREADABLE',
      'Failed to generate CG.',
      messageOf(err)
    )
  }
}

/** Copies a semester's picture to `to`, where the native save dialog pointed. */
export async function copyEndingArtTo(
  playthroughId: string,
  to: string,
  semesterId?: string
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafeSemesterId(semesterId)
  try {
    await copyFile(getEndingArtPath(playthroughId, semesterId), to)
  } catch (err) {
    throw appError(
      'ENDING_ART_UNEXPORTABLE',
      'Failed to save the ending CG.',
      messageOf(err)
    )
  }
}
