import { appError } from '@shared/errors'
import {
  assertLoreFileSize,
  assertSafeLoreBookId,
  emptyLoreIndex,
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
import { database, storage } from './db/open'
import { pickFile } from './transfer'

/** Prompt Studio's lorebooks on the browser build: the same rules as the desktop's folder, over one row for the index and one row per book. */

const INDEX_KEY = 'loreIndex'

/** Every readable book, by the id each is kept under; a malformed one is left out with a warning. */
async function readBooks(): Promise<LoreBook[]> {
  const rows = await storage('read the lorebooks', async () => {
    const db = await database()
    const keys = await db.getAllKeys('loreBooks')
    return Promise.all(keys.map(async (key) => [key, await db.get('loreBooks', key)] as const))
  })
  const books: LoreBook[] = []
  for (const [key, row] of rows) {
    const book = readStoredLoreBook(row, key)
    if (book) books.push(book)
    else console.warn(`[lorebooks] ${key} is not a valid lorebook; leaving it unused.`)
  }
  return books
}

/** Replaces the index row. */
async function writeIndex(index: LoreIndex): Promise<void> {
  await storage('save the lorebooks', async () => (await database()).put('loreIndex', index, INDEX_KEY))
}

/** Every readable book and the index with `on` repaired to name only those; a repair is written back, and a foreign index is refused. */
async function readStore(): Promise<{ books: LoreBook[]; index: LoreIndex }> {
  const books = await readBooks()
  const stored = await storage('read the lorebooks', async () => (await database()).get('loreIndex', INDEX_KEY))
  if (stored === undefined) return { books, index: emptyLoreIndex() }
  const index = readLoreIndex(stored, new Set(books.map((b) => b.id)), INDEX_KEY)
  if (!sameLoreIndex(index, stored)) await writeIndex(index)
  return { books, index }
}

/** `lorebooks.list` — the index and every book's summary, by name. */
export async function listLorebooks(): Promise<LoreBookListing> {
  const { books, index } = await readStore()
  return loreListingOf(index, books)
}

/** `lorebooks.get` — one book whole. */
export async function getLorebook(id: string): Promise<LoreBook> {
  assertSafeLoreBookId(id)
  const row = await storage('read the lorebook', async () => (await database()).get('loreBooks', id))
  const book = readStoredLoreBook(row, id)
  if (!book) throw appError('LOREBOOK_NOT_FOUND', 'That lorebook is not stored.', id)
  return book
}

/** `lorebooks.save` — keeps a book under its own id, replacing one already there. */
export async function saveLorebook(book: LoreBook): Promise<void> {
  assertSafeLoreBookId(book?.id)
  const kept = loreBookToKeep(book)
  await storage('save the lorebook', async () => (await database()).put('loreBooks', kept, kept.id))
}

/** `lorebooks.delete` — removes one and takes it off the books that are on. */
export async function deleteLorebook(id: string): Promise<void> {
  assertSafeLoreBookId(id)
  await storage('delete the lorebook', async () => (await database()).delete('loreBooks', id))
  const { index } = await readStore()
  if (index.on.includes(id)) await writeIndex({ ...index, on: index.on.filter((x) => x !== id) })
}

/** `lorebooks.setOn` — replaces which books are on; ids nothing is kept under are left out. */
export async function setLorebooksOn(ids: string[]): Promise<void> {
  const { books, index } = await readStore()
  await writeIndex(loreIndexToKeep({ ...index, on: ids }, new Set(books.map((b) => b.id))))
}

/** `lorebooks.saveShipped` — replaces the shipped entries as edited. */
export async function saveLorebookShipped(shipped: ShippedLoreOverrides): Promise<void> {
  const { books, index } = await readStore()
  await writeIndex(loreIndexToKeep({ on: index.on, shipped }, new Set(books.map((b) => b.id))))
}

/** `lorebooks.import` — reads the file the player picks as text, with its name; nothing is parsed or kept, and null where nothing was picked. */
export async function pickLorebookFile(): Promise<LoreBookFile | null> {
  const file = await pickFile('.json,application/json')
  if (!file) return null
  assertLoreFileSize(file.size)
  return { text: await file.text(), fileName: file.name }
}
