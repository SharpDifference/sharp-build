import { useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ConfirmModal } from '../components/ConfirmModal'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { TextField } from '../components/TextField'
import type { ScreenTheme } from './clockTheme'
import { gestures, lift, panelUnderTab, press, quietLift, quietPress, veilIn } from './motion'
import '../vu_styles/SystemPrompt.css'

export interface SystemPromptModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  /** The panel's name, on its tab. */
  title: string
  /** The field's label; the box is called this to a screen reader. */
  fieldLabel?: string
  /** What leaving unsaved says is lost. */
  discardMessage?: string
  /** What Reset returns to, and what a saved text equal to it is stored as: nothing. */
  defaultText: string
  /** Lets an empty text be saved, for a text whose default is empty. */
  allowEmpty?: boolean
  /** What is in force now: the stored text, or the default where nothing has replaced it. */
  stored: string
  /** Keeps the text, or clears the edit where it is `undefined`. False when the write failed. */
  onSave: (value: string | undefined) => Promise<boolean>
  onClose: () => void
}

/** One fixed text opened for hand-editing, with Reset back to its default and a gate against losing changes. */
export function SystemPromptModal({
  theme,
  title,
  fieldLabel = 'System prompt',
  discardMessage = 'The system prompt has not been saved.',
  defaultText,
  allowEmpty = false,
  stored,
  onSave,
  onClose
}: SystemPromptModalProps): JSX.Element | null {
  const [text, setText] = useState(stored)
  // Holds off a second click while Save's write is in flight.
  const saving = useRef(false)
  // The gate in front of leaving with the well not matching what is stored.
  const [closing, setClosing] = useState(false)

  const atDefault = text === defaultText
  const empty = !allowEmpty && text.trim().length === 0

  /** Writes the well, clearing back to the shipped default where the two now agree. */
  async function handleSave(): Promise<void> {
    if (saving.current || empty) return
    saving.current = true
    const value = text.replace(/\s+$/, '')
    const ok = await onSave(value === defaultText ? undefined : value)
    saving.current = false
    if (ok) onClose()
  }

  /** The gate in front of leaving: a discard confirm while the well disagrees with what is stored. */
  function requestClose(): void {
    if (text !== stored) setClosing(true)
    else onClose()
  }

  const { host, overlayProps } = useModalShell(requestClose)
  if (!host) return null

  return createPortal(
    <>
      <motion.div
        className="vu-veil"
        data-theme={theme}
        variants={veilIn}
        initial="hidden"
        animate="shown"
        exit="gone"
        {...overlayProps}
      >
        <motion.div
          id="system-prompt-modal"
          className="vu-sysprompt vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>{title}</TitleTab>

          <TextField
            id="sysprompt-text"
            label={fieldLabel}
            value={text}
            onChange={setText}
            multiline
          />

          <div className="vu-foot">
            <motion.button
              id="sysprompt-reset"
              className="vu-btn vu-btn--quiet"
              type="button"
              disabled={atDefault}
              {...gestures(atDefault, quietLift, quietPress)}
              onClick={() => setText(defaultText)}
            >
              Reset to default
            </motion.button>
            <motion.button
              id="sysprompt-save"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              type="button"
              disabled={empty}
              {...gestures(empty, lift, press)}
              onClick={() => void handleSave()}
            >
              Save
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Sibling of the veil, not a child: the confirm leaves when this panel does. */}
      <AnimatePresence propagate>
        {closing && (
          <ConfirmModal
            key="discard"
            id="sysprompt-discard"
            theme={theme}
            title="Discard changes?"
            message={discardMessage}
            confirmText="Discard changes"
            cancelText="Keep editing"
            // Taken down before the panel goes, so the two do not leave as one exiting child
            // rendered twice under the same key.
            onConfirm={() => {
              setClosing(false)
              onClose()
            }}
            onCancel={() => setClosing(false)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
