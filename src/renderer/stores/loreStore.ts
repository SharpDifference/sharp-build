import { create } from 'zustand'
import type {
  LoreBook,
  LoreBookFile,
  LoreBookSummary,
  LoreIndex,
  ShippedLoreOverrides
} from '@shared/lorebooks/types'
import { emptyLoreIndex } from '@shared/lorebooks/rules'
import { mergeLorebooks, type LorebooksBackup } from '@shared/presets/studioBackup'
import { PROMPT_STUDIO_MOD } from '@shared/presets/types'
import type { AppError } from '@shared/types'
import { effectiveLore } from '../prompts/effectiveLore'
import { SHIPPED_LORE, type EffectiveLore } from '../prompts/lorebook'
import { modIsOn } from './modsStore'
import { useUiStore } from './uiStore'

/** Prompt Studio's lorebooks: the shipped entries as edited, the player's books, and the lorebook the prompts read from them. */
interface LoreState {
  /** The shipped entries as edited and the books that are on, as last read. */
  index: LoreIndex
  /** Every book's summary, by name. */
  summaries: LoreBookSummary[]
  /** Every readable book whole, by id. */
  books: Record<string, LoreBook>
  /** The lorebook the prompts read, rebuilt only when the index or a book changes. */
  lore: EffectiveLore
  /** Whether the last read landed, failed, or has not happened yet. */
  status: 'idle' | 'ready' | 'failed'

  /** Reads the index and every book. A failure is logged and leaves the lorebook as it was. */
  load: () => Promise<boolean>
  /** Keeps a book under its own id. False when the write failed. */
  saveBook: (book: LoreBook) => Promise<boolean>
  /** Keeps a new book and turns it on. False when a write failed. */
  addBook: (book: LoreBook) => Promise<boolean>
  /** Removes a book. False when it failed. */
  removeBook: (id: string) => Promise<boolean>
  /** Turns one book on, to be applied after the others, or off. False when the write failed. */
  setBookOn: (id: string, on: boolean) => Promise<boolean>
  /** Replaces the shipped entries' edits. False when the write failed. */
  saveShipped: (shipped: ShippedLoreOverrides) => Promise<boolean>
  /** Merges a restored backup into the stored books, the file winning, and writes the result. False when a write failed. */
  restore: (file: LorebooksBackup) => Promise<boolean>
  /** Reads a file the player picks as text; null where nothing was picked or it failed. */
  pickFile: () => Promise<LoreBookFile | null>
}

/** The tail of the work lane: each action sees the store as the one before it left it. */
let tail: Promise<unknown> = Promise.resolve()

/** Runs `work` after everything queued before it. */
function inLane<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work)
  tail = next.catch(() => undefined)
  return next
}

/** Tells the player a request failed. */
function report(error: AppError): void {
  useUiStore.getState().showError(error)
}

export const useLoreStore = create<LoreState>((set, get) => {
  /** Reads the index and every book into the store, and rebuilds the lorebook from them. */
  async function refresh(): Promise<boolean> {
    const listed = await window.api.lorebooks.list()
    if (!listed.ok) {
      console.error('[lorebooks] the lorebooks could not be read', listed.error)
      set({ status: 'failed' })
      return false
    }
    const reads = await Promise.all(listed.data.books.map((summary) => window.api.lorebooks.get(summary.id)))
    const books: Record<string, LoreBook> = {}
    for (const read of reads) {
      if (read.ok) books[read.data.id] = read.data
      else console.error('[lorebooks] a lorebook could not be read', read.error)
    }
    set({
      index: listed.data.index,
      summaries: listed.data.books.filter((summary) => books[summary.id] !== undefined),
      books,
      lore: effectiveLore(listed.data.index, books, listed.data.index.on),
      status: 'ready'
    })
    return true
  }

  /** Runs one write, then reads again; a failed write is shown to the player. */
  async function write(call: () => Promise<{ ok: true } | { ok: false; error: AppError }>): Promise<boolean> {
    // A store that could not be read is not written over: it may be one a newer build kept.
    if (!(await refresh())) {
      report({ code: 'LOREBOOK_UNREADABLE', message: 'The stored lorebooks could not be read, so nothing was saved.' })
      return false
    }
    const result = await call()
    if (!result.ok) {
      report(result.error)
      await refresh()
      return false
    }
    await refresh()
    return true
  }

  return {
    index: emptyLoreIndex(),
    summaries: [],
    books: {},
    lore: SHIPPED_LORE,
    status: 'idle',

    load: () => inLane(refresh),

    saveBook: (book) => inLane(() => write(() => window.api.lorebooks.save(book))),

    addBook: (book) =>
      inLane(() =>
        write(async () => {
          const saved = await window.api.lorebooks.save(book)
          if (!saved.ok) return saved
          return window.api.lorebooks.setOn([...get().index.on.filter((id) => id !== book.id), book.id])
        })
      ),

    removeBook: (id) => inLane(() => write(() => window.api.lorebooks.delete(id))),

    setBookOn: (id, on) =>
      inLane(() =>
        write(() => {
          const rest = get().index.on.filter((other) => other !== id)
          return window.api.lorebooks.setOn(on ? [...rest, id] : rest)
        })
      ),

    saveShipped: (shipped) => inLane(() => write(() => window.api.lorebooks.saveShipped(shipped))),

    restore: (file) =>
      inLane(() =>
        write(async () => {
          const merge = mergeLorebooks({ index: get().index, books: Object.values(get().books) }, file)
          for (const book of merge.books) {
            const saved = await window.api.lorebooks.save(book)
            if (!saved.ok) return saved
          }
          const on = await window.api.lorebooks.setOn(merge.index.on)
          if (!on.ok) return on
          return window.api.lorebooks.saveShipped(merge.index.shipped ?? {})
        })
      ),

    pickFile: async () => {
      const result = await window.api.lorebooks.import()
      if (!result.ok) {
        report(result.error)
        return null
      }
      return result.data
    }
  }
})

/**
 * The lorebook the prompts read: the shipped one, untouched, while Prompt Studio is off, and
 * otherwise the shipped one as the player has edited it, with their books.
 */
export function loreNow(): EffectiveLore {
  return modIsOn(PROMPT_STUDIO_MOD) ? useLoreStore.getState().lore : SHIPPED_LORE
}
