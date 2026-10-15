import type { JSX } from 'react'
import { motion } from 'motion/react'
import {
  COMFY_MODEL_SLOTS,
  resolveModelPick,
  storedPickOf,
  type ComfyModelLists,
  type ComfyModelPicks,
  type ComfyModelRole,
  type ComfyModelSlot,
  type ComfySource
} from '@shared/comfyModels'
import { FolderIcon } from '../views/characterIcons'
import { gestures, linkLift, quietLift, quietPress } from '../views/motion'
import { SelectField } from './SelectField'
import { TextField } from './TextField'
import '../vu_styles/ComfyModels.css'

export interface ComfyModelPickerProps {
  /** Prefixes every control's id, so two screens' pickers never share one. */
  idPrefix: string
  /** Which ComfyUI the picks are for, which decides what a slot left unpicked draws. */
  source: ComfySource
  picks: ComfyModelPicks | undefined
  models: ComfyModelLists
  /** Whether a list has arrived, which is what marks a pick it lacks as missing. */
  listed: boolean
  folders: Record<ComfyModelRole, boolean>
  onPick: (role: ComfyModelRole, value: string) => void
  onOpenFolder: (role: ComfyModelRole) => void
  /** The LoRA weight as typed, shown blank while the LoRA is None. */
  weightText: string
  onWeightText: (text: string) => void
  /** Fires when the weight is left, for whatever its text is checked against. */
  onWeightBlur: () => void
}

/** The file one slot draws with, as the job would resolve it against the list shown. */
export function resolvedPickOf(
  slot: ComfyModelSlot,
  picks: ComfyModelPicks | undefined,
  models: ComfyModelLists,
  source: ComfySource
): string {
  return resolveModelPick(storedPickOf(picks, slot.role), slot, models[slot.role], source)
}

/** One line per slot whose pick the server's list lacks, in the pickers' order. */
export function missingModelLines(
  picks: ComfyModelPicks | undefined,
  models: ComfyModelLists,
  source: ComfySource
): string[] {
  const lines: string[] = []
  for (const slot of COMFY_MODEL_SLOTS) {
    const pick = resolvedPickOf(slot, picks, models, source)
    if (pick === '' || models[slot.role].includes(pick)) continue
    lines.push(`Missing ${slot.label.toLowerCase()}: ${pick}`)
  }
  return lines
}

/** A slot's options: None for the LoRA, every listed file, and the pick wherever the list lacks it. */
function optionsOf(
  slot: ComfyModelSlot,
  pick: string,
  models: ComfyModelLists,
  listed: boolean
): { value: string; label: string }[] {
  const list = models[slot.role]
  const options = slot.optional ? [{ value: '', label: 'None' }] : []
  options.push(...list.map((name) => ({ value: name, label: name })))
  if (pick !== '' && !list.includes(pick)) {
    options.push({ value: pick, label: listed ? `${pick} (missing)` : pick })
  }
  return options
}

/**
 * One picker per model slot, each with the folder its files go in beside it where the app can
 * open that folder, and under it a link to the model the game ships in that slot. The LoRA's
 * weight stands between its picker and the folder, dead while the LoRA is None.
 */
export function ComfyModelPicker({
  idPrefix,
  source,
  picks,
  models,
  listed,
  folders,
  onPick,
  onOpenFolder,
  weightText,
  onWeightText,
  onWeightBlur
}: ComfyModelPickerProps): JSX.Element {
  return (
    <div className="vu-comfy-models">
      {COMFY_MODEL_SLOTS.map((slot) => {
        const pick = resolvedPickOf(slot, picks, models, source)
        return (
          <div className="vu-comfy-model" key={slot.role}>
            <SelectField
              id={`${idPrefix}-${slot.role}`}
              label={slot.label}
              value={pick}
              onChange={(value) => onPick(slot.role, value)}
              options={optionsOf(slot, pick, models, listed)}
              hint={
                <>
                  Recommended:{' '}
                  <motion.a
                    className="vu-link"
                    href={slot.pin.url}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={linkLift}
                    whileFocus={linkLift}
                  >
                    {slot.pin.label}
                  </motion.a>
                </>
              }
            />
            {slot.optional && (
              <div className="vu-comfy-weight">
                <TextField
                  id={`${idPrefix}-${slot.role}-weight`}
                  label="Weight"
                  value={pick === '' ? '' : weightText}
                  onChange={onWeightText}
                  onBlur={onWeightBlur}
                  maxLength={8}
                  disabled={pick === ''}
                />
              </div>
            )}
            {folders[slot.role] && (
              <motion.button
                id={`${idPrefix}-${slot.role}-folder`}
                className="vu-square"
                type="button"
                aria-label="Open folder"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => onOpenFolder(slot.role)}
              >
                <FolderIcon />
              </motion.button>
            )}
          </div>
        )
      })}
    </div>
  )
}
