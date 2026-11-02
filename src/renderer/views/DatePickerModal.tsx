import { useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { WEEK_COLUMNS, WEEK_DAY_HEADERS } from '@shared/jobs'
import { calendarOf, type SemesterCalendar } from '@shared/semesters'
import type { Season } from '@shared/types'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { formatDatePart } from '../prompts/gameDate'
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
  veilIn
} from './motion'
import { ChevronIcon } from './screenIcons'
import '../vu_styles/Calendar.css'
import '../vu_styles/DatePicker.css'

export interface DatePickerModalProps {
  /** Drawn by the screen that opened this — a portal inherits no palette. */
  theme: ScreenTheme
  /** What the panel's ids are built on. */
  id: string
  /** The day picked now; the grid opens on its month and rings it. */
  date: number
  /** The first and last days that may be picked. */
  first: number
  last: number
  /** The semester whose months and days the dates are printed in. */
  season: Season
  /** Whether each day carries its occasions, with the legend saying so. */
  occasions?: boolean
  /** The occasions each day carries: the season's fixed ones as the build ships them by default. */
  calendar?: SemesterCalendar
  /** Whether a day between `first` and `last` may be picked; one refused is dimmed, its occasions kept. */
  allows?: (date: number) => boolean
  onPick: (date: number) => void
  onClose: () => void
}

/**
 * The Calendar's month grid without its day pane: the days between `first` and `last` that
 * `allows` takes are pressable, each carrying the occasions it falls in where asked, and a pick
 * answers at once. The Scene Creator picks a scene's day with it, New Game a day before the
 * semester or one its occasions move to.
 */
export function DatePickerModal({
  theme,
  id,
  date,
  first: firstDay,
  last: lastDay,
  season,
  occasions = false,
  calendar: given,
  allows,
  onPick,
  onClose
}: DatePickerModalProps): JSX.Element | null {
  const months = useMemo(() => monthsBetween(firstDay, lastDay, season), [firstDay, lastDay, season])
  const shipped = useMemo(() => calendarOf(season, [], {}), [season])
  const calendar = given ?? shipped
  const [month, setMonth] = useState(() => monthIndexIn(months, date))
  const { host, overlayProps } = useModalShell(onClose)

  const { first, last } = months[month]
  const firstMonth = month === 0
  const lastMonth = month === months.length - 1
  const cells = gridCellsOf(months[month])

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
        aria-label="Pick a date"
        variants={panelUnderTab}
      >
        <TitleTab>Pick a date</TitleTab>

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

            {occasions && (
              <div className="vu-cal-legend">
                <span className="vu-cal-key" data-cat="occasion">
                  Occasion
                </span>
              </div>
            )}
          </div>

          <div className="vu-cal-days">
            {WEEK_COLUMNS.map((weekday) => (
              <span className="vu-cal-dayname" key={weekday}>
                {WEEK_DAY_HEADERS[weekday]}
              </span>
            ))}
          </div>

          <div className="vu-cal-grid">
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

              const chips = (
                <span className="vu-cal-chips">
                  {occasions &&
                    occasionsOn(day, calendar).map((occasion) => (
                      <span className="vu-cal-chip" data-cat="occasion" key={occasion.id}>
                        <span className="vu-cal-chip-label">{occasion.title}</span>
                      </span>
                    ))}
                </span>
              )

              // A day the pick may not take: dimmed and not a control, what is on it still shown.
              if (allows && !allows(day)) {
                return (
                  <div className="vu-cal-cell vu-cal-cell--barred" key={day} data-day={day}>
                    <span className="vu-cal-num">{dayOfMonth(day, season)}</span>
                    {chips}
                  </div>
                )
              }

              const picked = day === date
              return (
                <motion.button
                  className={`vu-cal-cell${picked ? ' vu-cal-cell--on' : ''}`}
                  key={day}
                  type="button"
                  aria-pressed={picked}
                  aria-label={formatDatePart(day, season)}
                  data-day={day}
                  {...gestures(false, rowLift, rowPress)}
                  onClick={() => {
                    onPick(day)
                    onClose()
                  }}
                >
                  <span className="vu-cal-num">{dayOfMonth(day, season)}</span>
                  {chips}
                </motion.button>
              )
            })}
          </div>

          {/* Every pick is already an answer, so the foot carries one. */}
          <div className="vu-foot">
            <motion.button
              id={`${id}-close`}
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Close
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
