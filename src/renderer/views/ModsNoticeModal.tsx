import type { JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { DialogFrame } from '../components/DialogFrame'
import { useModalShell } from '../components/useModalShell'
import { notRunningLine, UNVERSIONED_LINE, useModSessionStore, type ModNotice } from '../stores/modSessionStore'
import { useUiStore } from '../stores/uiStore'
import { gestures, lift, press, quietLift, quietPress } from './motion'
import '../vu_styles/Dialog.css'

/**
 * The two notices about installed mods that are not running. At start, once per version of each
 * such mod: which did not start and why, with the Mods screen a button away; the game then starts
 * without them. On entering a game whose record names a `playthrough` mod that is not running:
 * that the game goes on without it, and which version of it the game was played with where that is
 * not the one installed. The quiet `unversioned` notice is the toast's, never this modal's.
 */
export function ModsNoticeModal({ theme, notice }: { theme: 'day' | 'night'; notice: ModNotice }): JSX.Element | null {
  const dismiss = useModSessionStore((s) => s.dismissNotice)
  const table = useModSessionStore((s) => s.table)
  const shiftStart = useModSessionStore((s) => s.shiftStart)
  const openModal = useUiStore((s) => s.openModal)
  const { host, overlayProps } = useModalShell(dismiss)
  if (!host) return null

  const count = notice.mods.length
  const title =
    notice.kind === 'start'
      ? `${count} ${count === 1 ? 'mod' : 'mods'} did not start`
      : `${count === 1 ? 'A mod' : `${count} mods`} this game started with ${count === 1 ? 'is' : 'are'} not running`

  return createPortal(
    <DialogFrame
      id="mods-notice"
      theme={theme}
      role="alertdialog"
      ariaLabel={title}
      overlayProps={overlayProps}
      title={title}
      foot={
        <>
          <motion.button
            id="mods-notice-open"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => {
              dismiss()
              openModal('mods')
            }}
          >
            Open Mods
          </motion.button>
          <motion.button
            id="mods-notice-continue"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={dismiss}
          >
            Continue
          </motion.button>
        </>
      }
    >
      <ul className="vu-mods-notice-list">
        {notice.mods.map((mod) => (
          <li key={mod.id} className="vu-note-text">
            <b>{mod.manifest?.name ?? mod.id}</b>
            {notice.kind === 'game' ? " isn't running this session" : ''}: {notRunningLine(mod, table, shiftStart)}
            {notice.playedWith?.[mod.id] !== undefined
              ? ` (this game was played with ${mod.manifest?.name ?? mod.id} ${notice.playedWith[mod.id]})`
              : ''}
          </li>
        ))}
      </ul>
      <p className="vu-note-text">
        {notice.kind === 'start'
          ? 'The game starts without them. What they saved is kept, and they come back once the cause is fixed.'
          : 'This game goes on without it.'}
      </p>
      {notice.unversioned && <p className="vu-note-text">{UNVERSIONED_LINE}</p>}
    </DialogFrame>,
    host
  )
}
