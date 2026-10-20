import { create } from 'zustand'
import { modOn } from '@shared/mods'
import { PROMPT_STUDIO_MOD, type Preset, type PresetImport, type PresetSummary } from '@shared/presets/types'
import type { AppError, StructuredRequest } from '@shared/types'
import type { PromptState } from '../prompts/scenePrompt'
import { modIsOn, useModsStore } from './modsStore'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

/** The Prompt Studio presets: the list, the one in force and what the studio previews. */
interface PromptStudioState {
  /** Every stored preset, by name; empty until the first load. */
  presets: PresetSummary[]
  /** The id in force. */
  activeId?: string
  /** The active preset whole, read by the builders for its scene text edits; absent until one has loaded. */
  active?: Preset
  /** The last scene call as its builder made it, before any preset was applied; what the studio's preview shows. */
  lastSceneRequest?: StructuredRequest

  /** Reads the list and the active preset. A failure is logged and leaves what was loaded. */
  load: () => Promise<void>
  /** Puts a preset in force. False when the write failed. */
  setActive: (id: string) => Promise<boolean>
  /** Keeps a preset under its own id, replacing one already there. False when the write failed. */
  save: (preset: Preset) => Promise<boolean>
  /** Removes one; the last is refused. False when it failed. */
  remove: (id: string) => Promise<boolean>
  /** Keeps a copy of one under a fresh id and returns that id, or null when it failed. */
  duplicate: (id: string) => Promise<string | null>
  /** Gives one a new name. False when it failed. */
  rename: (id: string, name: string) => Promise<boolean>
  /** Reads a file the player picks into a preset that is not yet kept; null where nothing was picked or it failed. */
  importFile: () => Promise<PresetImport | null>
  /** Remembers the last scene request a builder made. */
  noteSceneRequest: (request: StructuredRequest) => void
}

/** The tail of the work lane: each action sees the store as the one before it left it. */
let tail: Promise<unknown> = Promise.resolve()

/** The load in flight, so the boot and a switch turning on share one read. */
let loading: Promise<void> | null = null

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

export const usePromptStudioStore = create<PromptStudioState>((set) => {
  /** Reads the list and the active preset into the store; false where either read failed. */
  async function refresh(): Promise<boolean> {
    const listed = await window.api.presets.list()
    if (!listed.ok) {
      console.error('[presets] the presets could not be read', listed.error)
      return false
    }
    const { active: activeId, presets } = listed.data
    const read = await window.api.presets.get(activeId)
    if (!read.ok) {
      console.error('[presets] the active preset could not be read', read.error)
      set({ presets, activeId })
      return false
    }
    set({ presets, activeId, active: read.data })
    return true
  }

  /** Runs one write, then refreshes; a failed write is shown to the player. */
  async function write(call: () => Promise<{ ok: true } | { ok: false; error: AppError }>): Promise<boolean> {
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
    presets: [],

    load: () => {
      loading ??= inLane(async () => {
        try {
          await refresh()
        } catch (error) {
          console.error('[presets] the presets could not be read', error)
        }
      }).finally(() => {
        loading = null
      })
      return loading
    },

    setActive: (id) => inLane(() => write(() => window.api.presets.setActive(id))),

    save: (preset) => inLane(() => write(() => window.api.presets.save(preset))),

    remove: (id) => inLane(() => write(() => window.api.presets.delete(id))),

    duplicate: (id) =>
      inLane(async () => {
        const read = await window.api.presets.get(id)
        if (!read.ok) {
          report(read.error)
          return null
        }
        const copy: Preset = { ...read.data, id: crypto.randomUUID(), name: `${read.data.name} copy` }
        return (await write(() => window.api.presets.save(copy))) ? copy.id : null
      }),

    rename: (id, name) =>
      inLane(async () => {
        const read = await window.api.presets.get(id)
        if (!read.ok) {
          report(read.error)
          return false
        }
        return write(() => window.api.presets.save({ ...read.data, name }))
      }),

    importFile: async () => {
      const result = await window.api.presets.import()
      if (!result.ok) {
        report(result.error)
        return null
      }
      return result.data
    },

    noteSceneRequest: (request) => set({ lastSceneRequest: request })
  }
})

// The presets are read when the mod is switched on; the boot reads them when it already is.
useModsStore.subscribe((state, previous) => {
  if (modOn(state.switches, PROMPT_STUDIO_MOD) && !modOn(previous.switches, PROMPT_STUDIO_MOD)) {
    void usePromptStudioStore.getState().load()
  }
})

/**
 * Prompt Studio's edits to the fixed text blocks — the active preset's scene text and the
 * settings' global text — or absent while the mod is off.
 */
export function textEditsNow(): PromptState['textEdits'] {
  if (!modIsOn(PROMPT_STUDIO_MOD)) return undefined
  return {
    scene: usePromptStudioStore.getState().active?.overrides,
    global: useSettingsStore.getState().settings?.promptBlocks
  }
}
