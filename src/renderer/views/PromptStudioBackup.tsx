/**
 * The export and restore buttons of one Prompt Studio section, and the confirmation a restore
 * waits behind. Restoring merges the file into what the player has and writes only that section.
 */
import { useRef, useState, type JSX } from 'react'
import { AnimatePresence } from 'motion/react'
import {
  buildLorebooksBackup,
  buildPresetsBackup,
  buildPromptsBackup,
  mergeLorebooks,
  mergePresets,
  parseStudioBackup,
  studioBackupName,
  studioBackupWord,
  type StudioBackupKind,
  type StudioBackupOf
} from '@shared/presets/studioBackup'
import type { Preset } from '@shared/presets/types'
import { ConfirmModal } from '../components/ConfirmModal'
import { useLoreStore } from '../stores/loreStore'
import { usePromptStudioStore } from '../stores/promptStudioStore'
import { useUiStore } from '../stores/uiStore'
import type { ScreenTheme } from './clockTheme'
import { StudioPill } from './PromptStudioModals'

/** A restore waiting for the player's yes: the checked file of one kind. */
type Pending = { [K in StudioBackupKind]: { kind: K; backup: StudioBackupOf[K] } }[StudioBackupKind]

/** "1 thing" or "3 things". */
function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Tells the player a backup could not be used. */
function refuse(message: string): void {
  useUiStore.getState().showError({ code: 'STUDIO_BACKUP_INVALID', message })
}

/** The section as a backup file's text, or null where it could not be read (the player has been told). */
async function backupText(kind: StudioBackupKind): Promise<string | null> {
  if (kind === 'prompts') {
    return JSON.stringify(buildPromptsBackup(usePromptStudioStore.getState().prompts), null, 2)
  }
  if (kind === 'lorebooks') {
    const { index, books } = useLoreStore.getState()
    return JSON.stringify(buildLorebooksBackup(index, Object.values(books)), null, 2)
  }
  const listed = await window.api.presets.list()
  if (!listed.ok) {
    useUiStore.getState().showError(listed.error)
    return null
  }
  const reads = await Promise.all(listed.data.presets.map((summary) => window.api.presets.get(summary.id)))
  const presets: Preset[] = []
  for (const read of reads) {
    if (!read.ok) {
      useUiStore.getState().showError(read.error)
      return null
    }
    presets.push(read.data)
  }
  return JSON.stringify(buildPresetsBackup(presets, listed.data.active), null, 2)
}

/** The parts that are not nothing, joined into one sentence, or `none` where every part is. */
function sentence(parts: readonly (string | null)[], none: string): string {
  const kept = parts.filter((part): part is string => part !== null)
  if (kept.length === 0) return none
  const last = kept.pop() as string
  return `It ${kept.length > 0 ? `${kept.join(', ')} and ${last}` : last}.`
}

/** What a restore will do, one paragraph apiece. */
function describe(pending: Pending): string[] {
  const rest = 'Nothing else in Prompt Studio changes.'
  if (pending.kind === 'presets') {
    const merge = mergePresets(
      usePromptStudioStore.getState().presets.map((preset) => preset.id),
      pending.backup
    )
    const active = merge.save.find((preset) => preset.id === merge.active)
    return [
      sentence(
        [
          merge.added > 0 ? `adds ${counted(merge.added, 'preset', 'presets')}` : null,
          merge.replaced > 0 ? `replaces ${counted(merge.replaced, 'of yours', 'of yours')}` : null
        ],
        'It holds no presets.'
      ),
      `"${active?.name ?? ''}" becomes the active preset. ${rest}`
    ]
  }
  if (pending.kind === 'prompts') {
    const blocks = Object.keys(pending.backup.prompts.blocks ?? {}).length
    const sizes = Object.keys(pending.backup.prompts.classCatalog ?? {}).length
    return [
      sentence(
        [
          blocks > 0 ? `replaces ${counted(blocks, 'prompt', 'prompts')} with the file's` : null,
          sizes > 0 ? `sets ${counted(sizes, 'catalog size', 'catalog sizes')}` : null
        ],
        'It holds no edited prompts, so nothing changes.'
      ),
      `Any prompt it doesn't hold stays as it is. ${rest}`
    ]
  }
  const { index, books } = useLoreStore.getState()
  const merge = mergeLorebooks({ index, books: Object.values(books) }, pending.backup)
  return [
    sentence(
      [
        merge.added > 0 ? `adds ${counted(merge.added, 'lorebook', 'lorebooks')}` : null,
        merge.replaced > 0 ? `replaces ${counted(merge.replaced, 'of yours', 'of yours')}` : null,
        merge.edits > 0 ? `rewrites ${counted(merge.edits, 'entry', 'entries')} of the game lorebook` : null
      ],
      'It holds no lorebooks and no changes to the game lorebook.'
    ),
    `Books the file has on are turned on here. ${rest}`
  ]
}

/** The two buttons for one section and the confirmation they open. */
export function useStudioBackup(theme: ScreenTheme, kind: StudioBackupKind): { actions: JSX.Element; panel: JSX.Element } {
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const word = studioBackupWord(kind)

  /** Saves the section to a file the player chooses. */
  async function exportFile(): Promise<void> {
    if (working.current) return
    working.current = true
    try {
      const text = await backupText(kind)
      if (text === null) return
      const saved = await window.api.studioBackup.save(studioBackupName(kind), text)
      if (!saved.ok) useUiStore.getState().showError(saved.error)
    } finally {
      working.current = false
    }
  }

  /** Reads a file the player picks, checks it whole, then opens the confirmation. */
  async function pickFile(): Promise<void> {
    if (working.current) return
    working.current = true
    try {
      const picked = await window.api.studioBackup.pick()
      if (!picked.ok) {
        useUiStore.getState().showError(picked.error)
        return
      }
      if (!picked.data) return
      const checked = parseStudioBackup(kind, picked.data.text)
      if (!checked.ok) {
        refuse(checked.error)
        return
      }
      setPending({ kind, backup: checked.backup } as Pending)
    } finally {
      working.current = false
    }
  }

  /** Merges the checked file into the section. */
  async function restore(file: Pending): Promise<void> {
    setBusy(true)
    try {
      if (file.kind === 'presets') {
        const ids = usePromptStudioStore.getState().presets.map((preset) => preset.id)
        await usePromptStudioStore.getState().restorePresets(mergePresets(ids, file.backup))
      } else if (file.kind === 'prompts') {
        await usePromptStudioStore.getState().restorePrompts(file.backup.prompts)
      } else {
        await useLoreStore.getState().restore(file.backup)
      }
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const actions = (
    <>
      <StudioPill id={`studio-export-${kind}`} word={`Export ${word}`} onClick={() => void exportFile()} />
      <StudioPill id={`studio-restore-${kind}`} word={`Restore ${word}`} onClick={() => void pickFile()} />
    </>
  )

  const panel = (
    <AnimatePresence propagate>
      {pending && (
        <ConfirmModal
          key={`studio-restore-${kind}`}
          id={`studio-restore-${kind}-confirm`}
          theme={theme}
          title={`Restore ${word}?`}
          message={describe(pending)}
          confirmText={`Restore ${word}`}
          cancelText="Cancel"
          busy={busy}
          busyText="Restoring"
          onConfirm={() => void restore(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </AnimatePresence>
  )

  return { actions, panel }
}
