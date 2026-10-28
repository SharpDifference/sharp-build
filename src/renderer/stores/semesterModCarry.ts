import { carryModSlices } from '@vx/modkit/host/renderer'
import { carryModFields, type ModCarryFields, type TermCarryContext } from '@shared/modCarry'
import { semesterShiftOf } from '@shared/semesters'
import type { Character, GameSave, ModSlice, SaveDraft, Season } from '@shared/types'

/** The semester being left, as the ending's carry knows it. */
export interface LeavingSemester {
  playthroughId: string
  /** Zero-based index of the semester that ended. */
  index: number
  season: Season
  /** Every character the playthrough knows, by charId. */
  characters: Record<string, Character>
}

/**
 * What the mods carry out of a finished semester into New Game+: each field a mod registered
 * with `registerTermCarry`, read off the ending's save by that mod's own adapter. The game's own
 * carry composes the next save field by field and knows nothing of a mod's fields, so this rides
 * beside it on the carry and the next semester's opening save takes it back in. Dates move back
 * by the same shift the game's carry uses, so a mod's dates land on the new semester's clock.
 */
export function modFieldsLeaving(
  save: SaveDraft,
  leaving: LeavingSemester
): Partial<ModCarryFields> {
  const full: GameSave = {
    ...save,
    playthroughId: leaving.playthroughId,
    saveId: 'ending',
    saveDate: 0
  }
  return carryModFields(full, contextOf(leaving))
}

/**
 * What the mods' save fields carry out of a finished semester: the `ex` the next semester's
 * first save starts with, from the ending's slices as read and each registered mod's value, or
 * undefined where nothing is carried.
 */
export function modSlicesLeaving(
  read: Readonly<Record<string, ModSlice>>,
  values: Readonly<Record<string, unknown>>,
  leaving: LeavingSemester
): Record<string, ModSlice> | undefined {
  const ex = carryModSlices(read, values, contextOf(leaving))
  return Object.keys(ex).length > 0 ? ex : undefined
}

function contextOf(leaving: LeavingSemester): TermCarryContext {
  return {
    term: leaving.index,
    back: semesterShiftOf(leaving.season),
    characters: leaving.characters
  }
}
