import type { JSX } from 'react'
import { motion } from 'motion/react'
import type { Season } from '@shared/types'
import { formatGameDate } from '../prompts/gameDate'
import { gestures, quietLift, quietPress } from '../views/motion'
import '../vu_styles/DatePill.css'

export interface DatePillProps {
  id: string
  label: string
  date: number
  /** The semester whose months the date is printed in. */
  season: Season
  /** What the pill reads in place of the date, where what it opens picks more than one day. */
  reading?: string
  /** Opens the picker the date is changed in. */
  onPick: () => void
}

/** A date shown as a labelled pill, read in its semester's season, which opens the picker. */
export function DatePill({ id, label, date, season, reading, onPick }: DatePillProps): JSX.Element {
  return (
    <div className="vu-field">
      <span className="vu-field-label">{label}</span>
      <motion.button
        id={id}
        className="vu-pill vu-date-pill"
        type="button"
        {...gestures(false, quietLift, quietPress)}
        onClick={onPick}
      >
        {reading ?? formatGameDate(date, season)}
      </motion.button>
    </div>
  )
}
