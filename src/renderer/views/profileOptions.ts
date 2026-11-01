import { locationLabel } from '@shared/locations'

/** The selects a girl's profile is picked with, on the Profiles and Finalize screens. */

/** What every Profiles field shows while it is blank, and a select's blank option says. */
export const BLANK = 'Leave blank to generate'

/** One select option. */
export interface Option {
  value: string
  label: string
  disabled?: boolean
}

/** A select's options: its blank first, then the rest. */
export function withBlank(options: readonly Option[], blank = BLANK): Option[] {
  return [{ value: '', label: blank }, ...options]
}

/** A count's options, from `low` to `high`. */
export function counts(low: number, high: number): Option[] {
  return Array.from({ length: high - low + 1 }, (_, i) => ({
    value: String(low + i),
    label: String(low + i)
  }))
}

/** A menu's places as options, by location id. */
export function placeOptions(menu: Readonly<Record<string, string>>, except?: string): Option[] {
  return Object.values(menu)
    .filter((id) => id !== except)
    .map((id) => ({ value: id, label: locationLabel(id) }))
}

/** A number picked from a select, or undefined for its blank. */
export function numberOf(value: string): number | undefined {
  return value === '' ? undefined : Number(value)
}
