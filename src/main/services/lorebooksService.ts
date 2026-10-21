import { mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import { basename } from 'path'
import { appError, messageOf } from '@shared/errors'
import {
  assertLoreFileSize,
  assertSafeLoreBookId,
  emptyLoreIndex,
  isSafeLoreId,
  loreBookToKeep,
  loreIndexToKeep,
  loreListingOf,
  readLoreIndex,
  readStoredLoreBook,
  sameLoreIndex
} from '@shared/lorebooks/rules'
import type {
  LoreBook,
  LoreBookFile,
  LoreBookListing,
  LoreIndex,
  ShippedLoreOverrides
} from '@shared/lorebooks/types'
import { getLoreBookFilePath, getLoreBooksPath, getLoreIndexPath } from '../paths'
import { readJsonFile, writeAtomicJson } from './jsonFile'

/** The lorebooks Prompt Studio keeps: one `{id}.json` each under `data/prompt-studio/lorebooks`, and `index.json` holding the shipped entries as edited and which books are on. */

const UNREADABLE = { code: 'LOREBOOK_UNREADABLE', message: 'Could not read the lorebooks.' }
const UNWRITABLE = { code: 'LOREBOOK_UNWRITABLE', message: 'Could not save the lorebooks.' }

/** The ids of every lorebook file in the folder; a name that is no safe id is left out. */
async function storedIds(): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(getLoreBooksPath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError(UNREADABLE.code, UNREADABLE.message, messageOf(err))
  }
  return names
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.slice(0, -'.json'.length))
    .filter(isSafeLoreId)
}

/** Reads one lorebook file, or null (with a warning) where it is missing, damaged or kept under another id. */
async function readBookFile(id: string): Promise<LoreBook | null> {
  try {
    const read = await readJsonFile<null>(getLoreBookFilePath(id), {
      malformed: { code: 'LOREBOOK_MALFORMED', message: 'A lorebook is damaged.' },
      unreadable: UNREADABLE,
      onMissing: () => null
    })
    if (read.kind === 'missing') return null
    const book = readStoredLoreBook(read.parsed, id)
    if (!book) console.warn(`[lorebooks] ${id}.json is not a valid lorebook; leaving it unused.`)
    return book
  } catch (err) {
    console.warn(`[lorebooks] ${id}.json could not be read:`, messageOf(err))
    return null
  }
}

/** Writes one lorebook file. */
async function writeBook(book: LoreBook): Promise<void> {
  await mkdir(getLoreBooksPath(), { recursive: true })
  await writeAtomicJson(getLoreBookFilePath(book.id), book, UNWRITABLE)
}

/** Writes `index.json`. */
async function writeIndex(index: LoreIndex): Promise<void> {
  await mkdir(getLoreBooksPath(), { recursive: true })
  await writeAtomicJson(getLoreIndexPath(), index, UNWRITABLE)
}

/** Every readable book and the index with `on` repaired to name only those; a repair is written back, and a damaged or foreign index is refused. */
async function readStore(): Promise<{ books: LoreBook[]; index: LoreIndex }> {
  const books: LoreBook[] = []
  for (const id of await storedIds()) {
    const book = await readBookFile(id)
    if (book) books.push(book)
  }
  const read = await readJsonFile<LoreIndex>(getLoreIndexPath(), {
    malformed: { code: 'LOREBOOK_INDEX_MALFORMED', message: 'The lorebooks index is damaged.' },
    unreadable: UNREADABLE,
    onMissing: emptyLoreIndex
  })
  if (read.kind === 'missing') return { books, index: read.value }
  const index = readLoreIndex(read.parsed, new Set(books.map((b) => b.id)), getLoreIndexPath())
  if (!sameLoreIndex(index, read.parsed as LoreIndex)) await writeIndex(index)
  return { books, index }
}

/** `lorebooks:list` — the index and every book's summary, by name. */
export async function listLorebooks(): Promise<LoreBookListing> {
  const { books, index } = await readStore()
  return loreListingOf(index, books)
}

/** `lorebooks:get` — one book whole; an id nothing readable is kept under is refused. */
export async function getLorebook(id: string): Promise<LoreBook> {
  assertSafeLoreBookId(id)
  const book = await readBookFile(id)
  if (!book) throw appError('LOREBOOK_NOT_FOUND', 'That lorebook is not stored.', id)
  return book
}

/** `lorebooks:save` — keeps a book under its own id, replacing one already there. */
export async function saveLorebook(book: LoreBook): Promise<void> {
  assertSafeLoreBookId(book?.id)
  await writeBook(loreBookToKeep(book))
}

/** `lorebooks:delete` — removes one and takes it off the books that are on. */
export async function deleteLorebook(id: string): Promise<void> {
  assertSafeLoreBookId(id)
  await rm(getLoreBookFilePath(id), { force: true })
  const { index } = await readStore()
  if (index.on.includes(id)) await writeIndex({ ...index, on: index.on.filter((x) => x !== id) })
}

/** `lorebooks:setOn` — replaces which books are on; ids nothing is kept under are left out. */
export async function setLorebooksOn(ids: string[]): Promise<void> {
  const { books, index } = await readStore()
  const next = loreIndexToKeep({ ...index, on: ids }, new Set(books.map((b) => b.id)))
  await writeIndex(next)
}

/** `lorebooks:saveShipped` — replaces the shipped entries as edited. */
export async function saveLorebookShipped(shipped: ShippedLoreOverrides): Promise<void> {
  const { books, index } = await readStore()
  await writeIndex(loreIndexToKeep({ on: index.on, shipped }, new Set(books.map((b) => b.id))))
}

/** `lorebooks:import` — reads the file at `path` as text, with its name; nothing is parsed or kept. */
export async function readLorebookFile(path: string): Promise<LoreBookFile> {
  let text: string
  try {
    assertLoreFileSize((await stat(path)).size)
    text = await readFile(path, 'utf-8')
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'LOREBOOK_TOO_LARGE') throw err
    throw appError(UNREADABLE.code, 'Could not read that file.', messageOf(err))
  }
  return { text, fileName: basename(path) }
}
