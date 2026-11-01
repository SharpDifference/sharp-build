import { FINAL_DATE } from '@shared/classes'
import { WEEK_DAY_HEADERS } from '@shared/jobs'
import type { Season } from '@shared/types'
import { formatGameDate, weekdayOf } from '../prompts/gameDate'

/** The day-of-month for a date index of a `season` semester, read off the shared formatter. */
export function dayOfMonth(date: number, season: Season): number {
  return Number(formatGameDate(date, season).split(' ')[1])
}

/** `"May"` — the month name alone, for the navigation header. */
export function monthName(date: number, season: Season): string {
  return formatGameDate(date, season).split(' ')[0]
}

/** One calendar month the semester touches, in full: its first and last `date` index. */
export interface Month {
  first: number
  last: number
}

/**
 * The months the days from `from` to `to` touch, printed in a `season` semester's dates, each
 * drawn whole: the first one's days before `from` and the last one's after `to` are on the grid,
 * dimmed, so a month is always a month and the arrows never change the shape of what they page.
 */
export function monthsBetween(from: number, to: number, season: Season): readonly Month[] {
  const months: Month[] = []
  let first = from + 1 - dayOfMonth(from, season)
  while (first <= to) {
    let next = first + 28
    while (dayOfMonth(next, season) !== 1) next++
    months.push({ first, last: next - 1 })
    first = next
  }
  return months
}

/** Each season's months, worked out once. */
const MONTHS_BY_SEASON: Record<Season, readonly Month[]> = {
  spring: monthsBetween(0, FINAL_DATE, 'spring'),
  fall: monthsBetween(0, FINAL_DATE, 'fall')
}

/** The months a `season` semester touches, in order. */
export function monthsOf(season: Season): readonly Month[] {
  return MONTHS_BY_SEASON[season]
}

/** Which of a season's months a date falls in. */
export function monthIndexOf(date: number, season: Season): number {
  return monthIndexIn(monthsOf(season), date)
}

/** Which of `months` a date falls in, the first where it falls in none. */
export function monthIndexIn(months: readonly Month[], date: number): number {
  return Math.max(
    0,
    months.findIndex((month) => date >= month.first && date <= month.last)
  )
}

/** How many days one row of the grid holds, and how many rows it always draws. */
const WEEK_LENGTH = WEEK_DAY_HEADERS.length
const GRID_ROWS = 6

/**
 * The date index of every cell of a month's grid: six Sunday-first rows, the months either side
 * filling the first and the last out, so a cell is the same cell in every month.
 */
export function gridCellsOf(month: Month): number[] {
  const lead = weekdayOf(month.first)
  return Array.from({ length: WEEK_LENGTH * GRID_ROWS }, (_, i) => month.first - lead + i)
}
