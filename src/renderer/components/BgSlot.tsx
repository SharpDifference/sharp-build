import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { gestures, quietLift, quietPress } from '../views/motion'
import { DeleteX } from './DeleteX'
import '../vu_styles/BgSlot.css'

export interface BgSlotProps {
  /** Prefixes the two buttons' ids: `${idPrefix}-add-bg`, `${idPrefix}-change-bg`. */
  idPrefix: string
  /** The picked background's picture, or null while it has none to draw (or none is picked). */
  src: string | null
  /** Whether a background is picked: the thumbnail, Change BG and the ✕, rather than Add BG. */
  picked: boolean
  onPick: () => void
  onClear: () => void
}

/** The background a picture or scene is set in: the add pill alone, or the picture beside its change pill and ✕. */
export function BgSlot({ idPrefix, src, picked, onPick, onClear }: BgSlotProps): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      className="vu-bg-slot"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {picked ? (
        <>
          <span className="vu-bg-slot-thumb">
            {src !== null && <img className="vu-bg-slot-img" src={src} alt="" />}
          </span>
          <motion.button
            id={`${idPrefix}-change-bg`}
            className="vu-pill"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={onPick}
          >
            Change BG
          </motion.button>
          <DeleteX
            className="vu-x"
            hovered={hovered}
            label="Remove the background"
            onDelete={onClear}
          />
        </>
      ) : (
        <motion.button
          id={`${idPrefix}-add-bg`}
          className="vu-pill"
          type="button"
          {...gestures(false, quietLift, quietPress)}
          onClick={onPick}
        >
          Add BG
        </motion.button>
      )}
    </motion.div>
  )
}
