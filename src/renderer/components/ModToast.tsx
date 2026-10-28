import type { JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { UNVERSIONED_LINE, useModSessionStore } from '../stores/modSessionStore'
import { gestures, lift, press, quietLift, quietPress } from '../views/motion'
import '../vu_styles/Mods.css'

/**
 * The one toast in the app, for a mod author: a developer folder changed while a game was on.
 * A full reload is the only honest reload of an ES module, and a running game is never reloaded
 * unasked, so the change is offered instead: a reload for `renderer.js` and the assets, a
 * restart for `main.js`, which main code cannot swap in place.
 *
 * And, when no folder has changed, the quiet notice: the game just entered was started before
 * mods recorded their versions. One line and a button; nothing waits on it.
 */
export function ModToast(): JSX.Element {
  const change = useModSessionStore((s) => s.devChange)
  const setDevChange = useModSessionStore((s) => s.setDevChange)
  const unversioned = useModSessionStore((s) => s.notice?.kind === 'unversioned')
  const dismissNotice = useModSessionStore((s) => s.dismissNotice)

  return (
    <AnimatePresence>
      {change && (
        <motion.div
          key={`${change.id}:${change.kind}`}
          id="mods-toast"
          className="vu-mods-toast vu-paper"
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <span className="vu-mods-toast-text">
            {change.kind === 'main'
              ? `${change.id}: main.js changed. Restart to load it.`
              : `${change.id} changed. Reload to see it; whatever is not saved goes.`}
          </span>
          <motion.button
            id="mods-toast-later"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => setDevChange(null)}
          >
            Later
          </motion.button>
          <motion.button
            id="mods-toast-now"
            className="vu-btn vu-btn--primary vu-paper"
            type="button"
            {...gestures(false, lift, press)}
            onClick={() => {
              if (change.kind === 'main') void window.api.mods.restart()
              else window.location.reload()
            }}
          >
            {change.kind === 'main' ? 'Restart' : 'Reload now'}
          </motion.button>
        </motion.div>
      )}
      {!change && unversioned && (
        <motion.div
          key="unversioned"
          id="mods-toast-unversioned"
          className="vu-mods-toast vu-paper"
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <span className="vu-mods-toast-text">{UNVERSIONED_LINE}</span>
          <motion.button
            id="mods-toast-unversioned-ok"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={dismissNotice}
          >
            OK
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
