import { create } from 'zustand'
import { toAppError } from '@shared/errors'
import {
  applyImport,
  emptyLorebook,
  normalizedLorebook,
  settingKeepable,
  withCustomEntry,
  withCustomPatch,
  withoutCustomEntry,
  withoutShippedEdit,
  withSetting,
  withShippedEdit,
  worldInfoOf,
  type LoreEdit,
  type LorebookRecord,
  type ShippedBook
} from '@shared/lorebookRecord'
import { effectiveLorebook, LOREBOOK, SHIPPED_BOOK, type BookEntry } from '../prompts/lorebook'
import { SETTING } from '../prompts/setting'
import { useUiStore } from './uiStore'

/**
 * The lorebook of the playthrough being played: read on the way into a game, dropped on the way
 * out, and written whole after every change the player makes. Its writes run one at a time and
 * outlive the stay that queued them, an edit being the player's rather than a decision point's.
 */

/** Where the playthrough's lorebook stands: none outside one, then read, or refused on reading. */
type LorebookStatus = 'none' | 'loading' | 'ready' | 'refused'

/** One of the player's own entries as the editor hands it over. */
interface CustomLoreFields {
  keys: readonly string[]
  text: string
  bg?: string
}

/** What an import brought in and left out, for the notice that follows it. */
export interface ImportOutcome {
  imported: number
  leftOut: number
}

interface LorebookState {
  playthroughId: string | null
  status: LorebookStatus
  /** As kept, read against this build. */
  record: LorebookRecord
  /** What every prompt reads; the shipped book until a playthrough's has been read. */
  book: readonly BookEntry[]
  /** The setting every prompt reads; the shipped one until a playthrough's has been read. */
  setting: string
  /**
   * Moved on by every load, import, reset and delete, so an editor holding a commit from before
   * one of them lands nothing.
   */
  revision: number

  /** Reads the playthrough's lorebook; `null` is the shipped book with nothing to write. */
  load: (playthroughId: string | null) => Promise<void>
  /** Back to the shipped book, on the way out of a game; queued writes still land. */
  drop: () => void
  /** Lays `patch` over a shipped entry; false where the editor's revision is stale. */
  editShipped: (ref: string, patch: LoreEdit, revision: number) => boolean
  /** Puts a shipped entry back as the build ships it. */
  resetShipped: (ref: string) => void
  /** Makes one of the player's entries and answers its id, or null where nothing was made. */
  createCustom: (fields: CustomLoreFields, revision: number) => string | null
  /** Changes one of the player's entries; a `bg` of null takes its background off. */
  updateCustom: (
    id: string,
    patch: { keys?: readonly string[]; text?: string; bg?: string | null },
    revision: number
  ) => boolean
  deleteCustom: (id: string) => void
  /** Rewrites the setting, the shipped one kept as absent; false where nothing could be kept. */
  editSetting: (text: string) => boolean
  /**
   * Has the player pick a SillyTavern lorebook and lays it in, replacing the lorebook or adding
   * its own entries to it; null where nothing came in. Calls the bridge before anything is
   * awaited, so a browser's picker opens inside the click that asked for it.
   */
  importWorld: (replace: boolean) => Promise<ImportOutcome | null>
  /** Hands the player the lorebook as a SillyTavern World Info file. */
  exportWorld: () => Promise<void>
}

/** The writes still to land, one after another. */
let queue: Promise<void> = Promise.resolve()
/** The read the stay's first prompts wait on. */
let loaded: Promise<void> = Promise.resolve()
/** Whether this stay has already said a write failed; once is enough. */
let warned = false

/** Queues one whole-record write behind every earlier one. */
function enqueue(playthroughId: string, record: LorebookRecord): void {
  queue = queue.then(async () => {
    const written = await window.api.lorebook.write(playthroughId, record)
    if (!written.ok && !warned) {
      warned = true
      useUiStore.getState().showError(written.error)
    }
  })
}

/** What the record's rules read of the build. */
const SHIPPED: ShippedBook = { entries: LOREBOOK, setting: SETTING }

/** What the prompts read of a record: its book and its setting. */
function readOf(record: LorebookRecord): { book: readonly BookEntry[]; setting: string } {
  return { book: effectiveLorebook(record), setting: record.setting ?? SETTING }
}

/** The shipped entry kept under `ref`. */
function shippedOf(ref: string): (typeof LOREBOOK)[number] | undefined {
  return LOREBOOK.find((entry) => entry.ref === ref)
}

export const useLorebookStore = create<LorebookState>((set, get) => {
  /**
   * Applies one change where the lorebook is read and the editor's revision is current, and
   * queues the write; false where it was refused.
   */
  const commit = (revision: number, change: (record: LorebookRecord) => LorebookRecord): boolean => {
    const state = get()
    if (state.status !== 'ready' || state.revision !== revision || !state.playthroughId) {
      return false
    }
    const record = change(state.record)
    if (JSON.stringify(record) === JSON.stringify(state.record)) return true
    set({ record, ...readOf(record) })
    enqueue(state.playthroughId, record)
    return true
  }

  return {
    playthroughId: null,
    status: 'none',
    record: emptyLorebook(),
    book: SHIPPED_BOOK,
    setting: SETTING,
    revision: 0,

    load: (playthroughId) => {
      const revision = get().revision + 1
      warned = false
      set({
        playthroughId,
        status: playthroughId ? 'loading' : 'none',
        record: emptyLorebook(),
        book: SHIPPED_BOOK,
        setting: SETTING,
        revision
      })
      if (!playthroughId) {
        loaded = Promise.resolve()
        return loaded
      }
      loaded = (async () => {
        // A write still queued for this playthrough lands before it is read back.
        await queue
        const read = await window.api.lorebook.read(playthroughId)
        if (get().revision !== revision) return
        if (!read.ok) {
          set({ status: 'refused' })
          useUiStore.getState().showError(read.error)
          return
        }
        const record = normalizedLorebook(read.data ?? emptyLorebook(), SHIPPED)
        set({ status: 'ready', record, ...readOf(record) })
      })()
      return loaded
    },

    drop: () =>
      set((state) => ({
        playthroughId: null,
        status: 'none',
        record: emptyLorebook(),
        book: SHIPPED_BOOK,
        setting: SETTING,
        revision: state.revision + 1
      })),

    editShipped: (ref, patch, revision) => {
      const shipped = shippedOf(ref)
      return shipped ? commit(revision, (record) => withShippedEdit(record, shipped, patch)) : false
    },

    resetShipped: (ref) => {
      if (commit(get().revision, (record) => withoutShippedEdit(record, ref))) {
        set((state) => ({ revision: state.revision + 1 }))
      }
    },

    createCustom: (fields, revision) => {
      let id: string | null = null
      commit(revision, (record) => {
        const made = withCustomEntry(record, fields)
        id = made.id
        return made.record
      })
      return id
    },

    updateCustom: (id, patch, revision) =>
      commit(revision, (record) => withCustomPatch(record, id, patch)),

    deleteCustom: (id) => {
      if (commit(get().revision, (record) => withoutCustomEntry(record, id))) {
        set((state) => ({ revision: state.revision + 1 }))
      }
    },

    editSetting: (text) => {
      if (!settingKeepable(text)) return false
      return commit(get().revision, (record) => withSetting(record, text, SETTING))
    },

    importWorld: async (replace) => {
      const before = get()
      const playthroughId = before.playthroughId
      if (!playthroughId || (before.status !== 'ready' && before.status !== 'refused')) return null
      const picked = await window.api.lorebook.import()
      if (!picked.ok) {
        useUiStore.getState().showError(picked.error)
        return null
      }
      const now = get()
      if (!picked.data || now.playthroughId !== playthroughId) return null
      // A lorebook that could not be read is only ever replaced.
      const readable = now.status === 'ready'
      try {
        const applied = applyImport(
          readable ? now.record : emptyLorebook(),
          picked.data,
          SHIPPED,
          replace || !readable
        )
        set({
          status: 'ready',
          record: applied.record,
          ...readOf(applied.record),
          revision: now.revision + 1
        })
        enqueue(playthroughId, applied.record)
        return { imported: applied.imported, leftOut: applied.leftOut }
      } catch (err) {
        useUiStore.getState().showError(toAppError(err, 'LOREBOOK_IMPORT_INVALID'))
        return null
      }
    },

    exportWorld: async () => {
      const exported = await window.api.lorebook.export(worldInfoOf(get().record, SHIPPED))
      if (!exported.ok) useUiStore.getState().showError(exported.error)
    }
  }
})

/** The book every prompt built now reads. */
export function lorebookNow(): readonly BookEntry[] {
  return useLorebookStore.getState().book
}

/** The setting every prompt built now reads. */
export function settingNow(): string {
  return useLorebookStore.getState().setting
}

/** Resolves once the playthrough's lorebook has been read, or refused. */
export function lorebookLoaded(): Promise<void> {
  return loaded
}

/** Resolves once every write already queued has landed or failed. */
export function lorebookSettled(): Promise<void> {
  return queue
}
