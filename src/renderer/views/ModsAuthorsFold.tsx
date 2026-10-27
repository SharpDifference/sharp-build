import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { gestures, quietLift, quietPress, rowLift, rowPress } from './motion'

const NO_FOLDERS: readonly string[] = []

/**
 * The "For mod authors" fold at the foot: the folders a mod is loaded from as it is built, each
 * removable, and the picker that adds one. Stored by main; a change takes effect at the next
 * start, like installing.
 */
export function ModsAuthorsFold(): JSX.Element {
  // The stored list itself, or the one shared empty list: a selector answering a fresh array
  // every call would have the store re-render without end.
  const folders = useSettingsStore((s) => s.settings?.devModFolders) ?? NO_FOLDERS
  const reload = useSettingsStore((s) => s.load)
  const showError = useUiStore((s) => s.showError)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { code: string; message: string; detail?: string } }>): Promise<void> {
    setBusy(true)
    const result = await action()
    if (!result.ok) showError(result.error)
    await reload()
    setBusy(false)
  }

  return (
    <details className="vu-disc vu-mods-authors">
      <motion.summary className="vu-disc-summary" {...gestures(false, rowLift, rowPress)}>
        For mod authors
      </motion.summary>
      <div className="vu-disc-body">
        <p className="vu-mods-option-hint">
          A folder holding an unzipped release (its <code>vxmod.json</code> beside its files) is loaded as
          a mod at the next start. While the game runs, a change to its files reloads it.
        </p>
        {folders.length > 0 && (
          <ul className="vu-mods-folders">
            {folders.map((folder) => (
              <li key={folder} className="vu-mods-folder">
                <span className="vu-mods-folder-path" title={folder}>
                  {folder}
                </span>
                <motion.button
                  className="vu-btn vu-btn--quiet"
                  type="button"
                  disabled={busy}
                  {...gestures(busy, quietLift, quietPress)}
                  onClick={() => void run(() => window.api.mods.removeDevFolder(folder))}
                >
                  Remove
                </motion.button>
              </li>
            ))}
          </ul>
        )}
        <motion.button
          id="mods-add-folder"
          className="vu-btn vu-btn--quiet"
          type="button"
          disabled={busy}
          {...gestures(busy, quietLift, quietPress)}
          onClick={() => void run(() => window.api.mods.addDevFolder())}
        >
          Load a mod from a folder…
        </motion.button>
      </div>
    </details>
  )
}
