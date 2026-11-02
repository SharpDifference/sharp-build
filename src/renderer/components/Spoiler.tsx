import type { JSX } from 'react'
import { motion } from 'motion/react'
import { UNKNOWN_NAME } from '../stores/gameStore'
import { gestures, quietLift, quietPress } from '../views/motion'
import { EyeOffIcon } from '../views/screenIcons'

/**
 * A random pick's face as New Game's setup masks it: the dashed question in her archway's place,
 * for the archway around it to hold.
 */
export function MaskedFace(): JSX.Element {
  return (
    <span className="vu-crop vu-crop--masked" aria-hidden="true">
      <span>?</span>
    </span>
  )
}

/** A random pick's name as setup masks it: the struck eye over the name box's mask, which a press lifts. */
export function SpoilerName({ id, onReveal }: { id?: string; onReveal: () => void }): JSX.Element {
  return (
    <motion.button
      id={id}
      className="vu-spoiler"
      type="button"
      aria-label="Reveal this character"
      {...gestures(false, quietLift, quietPress)}
      onClick={onReveal}
    >
      <EyeOffIcon size={15} />
      {UNKNOWN_NAME}
    </motion.button>
  )
}
