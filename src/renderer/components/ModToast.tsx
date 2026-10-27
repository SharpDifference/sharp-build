import type { JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useModSessionStore } from '../stores/modSessionStore'
import { gestures, lift, press, quietLift, quietPress } from '../views/motion'
import '../vu_styles/Mods.css'

/**
 * The one toast in the app, for a mod author: a developer folder changed while a game was on.
 * A full reload is the only honest reload of an ES module, and a running game is never reloaded
 * unasked, so the change is offered instead: a reload for `renderer.js` and the assets, a
 * restart for `main.js`, which main code cannot swap in place.
 */
export function ModToast(): JSX.Element {
  const change = useModSessionStore((s) => s.devChange)
  const setDevChange = useModSessionStore((s) => s.setDevChange)

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
    </AnimatePresence>
  )
}
