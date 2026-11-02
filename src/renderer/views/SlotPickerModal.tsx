import { useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { WEEK_COLUMNS, WEEK_DAY_HEADERS } from '@shared/jobs'
import type { SemesterCalendar } from '@shared/semesters'
import type { Season, TimeSlot } from '@shared/types'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { formatDatePart } from '../prompts/gameDate'
import type { PlannedSpan } from '../prompts/occasionPrompt'
import { occasionsOn } from '../prompts/occasions'
import { dayOfMonth, gridCellsOf, monthIndexIn, monthName, monthsBetween } from './calendarMonths'
import type { ScreenTheme } from './clockTheme'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  toggleLift,
  veilIn
} from './motion'
import { ChevronIcon, MoonIcon, SunIcon } from './screenIcons'
import '../vu_styles/Calendar.css'
import '../vu_styles/DatePicker.css'

export interface SlotPickerModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  /** What the panel's ids are built on. */
  id: string
  /** The days and half picked now; the grid opens on its first month. */
  span: PlannedSpan
  /** The first and last days that may be picked. */
  first: number
  last: number
  season: Season
  /** The occasions each day is labelled with. */
  calendar: SemesterCalendar
  onPick: (span: PlannedSpan) => void
  onClose: () => void
}

/** The three ways an occasion takes its days, in the order the palette stands them. */
const HALVES: readonly { time: TimeSlot | null; word: string; key: string }[] = [
  { time: 0, word: 'Day', key: 'day' },
  { time: 1, word: 'Night', key: 'night' },
  { time: null, word: 'All day', key: 'all' }
]

/** The mark a half is drawn with: the sun, the crescent, or both for the whole day. */
function HalvesMark({ time }: { time: TimeSlot | null }): JSX.Element {
  return (
    <span className="vu-slot-mark">
      {time !== 1 && <SunIcon strokeWidth={2.5} />}
      {time !== 0 && <MoonIcon strokeWidth={2.5} />}
    </span>
  )
}

/**
 * The date picker's month grid for the slots an occasion takes: a run of days, each one's day
 * half, night half or both. A press on a day picks it alone and the next press stretches the run
 * to the day pressed; the palette says which halves. Each live day draws its two halves, lit
 * where the run takes them, and Done answers.
 */
export function SlotPickerModal({
  theme,
  id,
  span: given,
  first: firstDay,
  last: lastDay,
  season,
  calendar,
  onPick,
  onClose
}: SlotPickerModalProps): JSX.Element | null {
  const months = useMemo(() => monthsBetween(firstDay, lastDay, season), [firstDay, lastDay, season])
  const [span, setSpan] = useState<PlannedSpan>(given)
  // The day a first press picked, waiting for the press that ends the run.
  const [anchor, setAnchor] = useState<number | null>(null)
  // The day under the pointer while the run waits for its end, so it is seen before it is pressed.
  const [hover, setHover] = useState<number | null>(null)
  const [month, setMonth] = useState(() => monthIndexIn(months, given.startDate))
  const done = (): void => {
    onPick(span)
    onClose()
  }
  const { host, overlayProps, primaryProps } = useModalShell(onClose, 'panel', done)

  const { first, last } = months[month]
  const firstMonth = month === 0
  const lastMonth = month === months.length - 1
  const cells = gridCellsOf(months[month])

  // The run as drawn: the one picked, or the one a second press would make.
  const end = anchor !== null && hover !== null ? hover : null
  const shown =
    end === null
      ? span
      : { ...span, startDate: Math.min(anchor ?? end, end), endDate: Math.max(anchor ?? end, end) }

  /** A press on a day: a run of that day alone, or the run from the day before it to this one. */
  const pressDay = (day: number): void => {
    if (anchor === null) {
      setSpan((s) => ({ ...s, startDate: day, endDate: day }))
      setAnchor(day)
      return
    }
    setSpan((s) => ({ ...s, startDate: Math.min(anchor, day), endDate: Math.max(anchor, day) }))
    setAnchor(null)
    setHover(null)
  }

  if (!host) return null

  return createPortal(
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
        id={id}
        className="vu-cal vu-cal--pick vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Pick the days"
        variants={panelUnderTab}
        {...primaryProps}
      >
        <TitleTab>Pick the days</TitleTab>

        <div className="vu-cal-month">
          <div className="vu-cal-head">
            {/* The range's ends are end-stops: dead, rendered, and saying nothing. */}
            <motion.button
              id={`${id}-prev`}
              className="vu-square vu-square--step vu-cal-step--back"
              type="button"
              aria-label="Previous month"
              disabled={firstMonth}
              {...gestures(firstMonth, quietLift, quietPress)}
              onClick={() => setMonth((m) => m - 1)}
            >
              <ChevronIcon />
            </motion.button>
            <span className="vu-cal-name">{monthName(first, season)}</span>
            <motion.button
              id={`${id}-next`}
              className="vu-square vu-square--step"
              type="button"
              aria-label="Next month"
              disabled={lastMonth}
              {...gestures(lastMonth, quietLift, quietPress)}
              onClick={() => setMonth((m) => m + 1)}
            >
              <ChevronIcon />
            </motion.button>

            <div className="vu-palette vu-slot-halves" role="group" aria-label="Time">
              {HALVES.map((half) => {
                const on = half.time === span.time
                return (
                  <motion.button
                    key={half.key}
                    id={`${id}-${half.key}`}
                    className={`vu-palette-btn${on ? ' vu-palette-btn--on' : ''}`}
                    type="button"
                    aria-pressed={on}
                    {...gestures(false, toggleLift, quietPress)}
                    onClick={() => setSpan((s) => ({ ...s, time: half.time }))}
                  >
                    <HalvesMark time={half.time} />
                    {half.word}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="vu-cal-days">
            {WEEK_COLUMNS.map((weekday) => (
              <span className="vu-cal-dayname" key={weekday}>
                {WEEK_DAY_HEADERS[weekday]}
              </span>
            ))}
          </div>

          <div className="vu-cal-grid" onMouseLeave={() => setHover(null)}>
            {cells.map((day) => {
              // Another month's day, or one that cannot be picked: a number and nothing else,
              // and not a control.
              if (day < first || day > last || day < firstDay || day > lastDay) {
                return (
                  <div className="vu-cal-cell vu-cal-cell--out" key={day}>
                    <span className="vu-cal-num">{dayOfMonth(day, season)}</span>
                  </div>
                )
              }

              const taken = day >= shown.startDate && day <= shown.endDate
              return (
                <motion.button
                  className={`vu-cal-cell vu-slot-cell${taken ? ' vu-cal-cell--on' : ''}`}
                  key={day}
                  type="button"
                  aria-pressed={taken}
                  aria-label={formatDatePart(day, season)}
                  data-day={day}
                  {...gestures(false, rowLift, rowPress)}
                  onMouseEnter={() => setHover(day)}
                  onClick={() => pressDay(day)}
                >
                  <span className="vu-cal-num">{dayOfMonth(day, season)}</span>
                  <span className="vu-cal-chips">
                    {occasionsOn(day, calendar).map((occasion) => (
                      <span className="vu-cal-chip" data-cat="occasion" key={occasion.id}>
                        <span className="vu-cal-chip-label">{occasion.title}</span>
                      </span>
                    ))}
                  </span>
                  <span className="vu-slot-pair" aria-hidden="true">
                    {([0, 1] as const).map((time) => (
                      <span
                        key={time}
                        className={`vu-slot-half${taken && (shown.time === null || shown.time === time) ? ' vu-slot-half--on' : ''}`}
                      >
                        {time === 0 ? <SunIcon strokeWidth={3} /> : <MoonIcon strokeWidth={3} />}
                      </span>
                    ))}
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="vu-foot">
            <motion.button
              id={`${id}-cancel`}
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={onClose}
            >
              Cancel
            </motion.button>
            <motion.button
              id={`${id}-done`}
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={done}
            >
              Done
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
