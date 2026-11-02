import { memo, useMemo, useState, type JSX, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  entryTouched,
  occasionFilled,
  withOccasionWords,
  type ApplicationDraft,
  type OccasionEntry,
  type PlannedOccasion
} from '@shared/application'
import {
  OCCASION_FIRST_DAY,
  OCCASION_KINDS,
  OCCASION_LAST_DAY,
  type OccasionKind
} from '@shared/occasionsFile'
import { calendarOf, type SemesterCalendar } from '@shared/semesters'
import type { FixedOccasionEdit, Occasion, Season } from '@shared/types'
import { ConfirmModal } from '../components/ConfirmModal'
import { DatePill } from '../components/DatePill'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { formatDatePart, formatShortGameDate, formatTimeSlot } from '../prompts/gameDate'
import { occasionKindOf, occasionOf } from '../prompts/occasionPrompt'
import {
  fixedOccasionEdited,
  fixedOccasionMovable,
  fixedOccasionMoves,
  fixedOccasionsOf,
  keptFixedEdits,
  removedFixedOccasionsOf,
  staticOccasionsOf,
  withFixedEdit
} from '../prompts/occasions'
import {
  addOccasion,
  canAddOccasion,
  clearOccasions,
  deleteOccasion,
  exportOccasions,
  importOccasions,
  moveOccasion,
  resetFixedOccasion,
  retypeOccasion,
  updateApplication,
  useApplicationStore,
  type ImportOutcome
} from '../stores/applicationStore'
import { monthName } from './calendarMonths'
import type { ScreenTheme } from './clockTheme'
import { DatePickerModal } from './DatePickerModal'
import { gestures, quietLift, quietPress } from './motion'
import { EntriesPanel, EntryRow, EntrySection } from './NewGameEntries'
import { DownloadIcon, PlusIcon, UploadIcon } from './screenIcons'
import { SlotPickerModal } from './SlotPickerModal'

/** What each kind of invented occasion is called on screen. */
export const OCCASION_KIND_WORDS: Record<OccasionKind, string> = {
  gala: 'Gala',
  dance: 'Dance',
  'career-fair': 'Career fair',
  concert: 'Concert',
  'small-event': 'Small event'
}

/** The kinds an invented occasion may be made, as its select offers them. */
const KIND_OPTIONS = OCCASION_KINDS.map((kind) => ({ value: kind, label: OCCASION_KIND_WORDS[kind] }))

/** The one line saying what each kind of occasion is, claiming no days. */
const PURPOSES: Record<OccasionKind, string> = {
  gala: 'A formal gala, the most expensive and most photographed event of the semester.',
  dance: 'A formal dance, smaller than the gala, that students dress up for.',
  'career-fair': 'A career fair, with recruiters at tables and students in interview clothes.',
  concert: 'A concert with a booked act and student openers.',
  'small-event':
    "Something small happening on campus or in the city, like a club's table, a market, a screening or a tournament."
}

/** A small event's line inside the week off, by the break that week is. */
const BREAK_PURPOSES: Record<Season, string> = {
  spring: 'Something small happening during spring break, while most of campus is away.',
  fall: 'Something small happening during Thanksgiving break, while everyone is still on campus.'
}

/** What every field of an invented occasion shows while it is blank. */
const BLANK = 'Leave blank to generate'

/** A planned occasion's kind, a stray id read as a small event. */
export function plannedKindOf(planned: PlannedOccasion): OccasionKind {
  return occasionKindOf(planned) ?? 'small-event'
}

/** The line saying what a planned occasion is for. */
function purposeOf(planned: PlannedOccasion, season: Season): string {
  const kind = plannedKindOf(planned)
  if (kind === 'small-event' && planned.breakWeek) return BREAK_PURPOSES[season]
  return PURPOSES[kind]
}

/** What a planned occasion is called on screen: the title written for it, else its kind. */
function plannedTitleOf(planned: PlannedOccasion, entry: OccasionEntry | undefined): string {
  return entry?.title.trim() || OCCASION_KIND_WORDS[plannedKindOf(planned)]
}

/** The days and half an occasion is on: its first day, its last where it runs longer, its half. */
export function whenOf(
  span: { startDate: number; endDate: number; time: Occasion['time'] },
  season: Season
): string {
  const days =
    span.endDate > span.startDate
      ? `${formatDatePart(span.startDate, season)} through ${formatDatePart(span.endDate, season)}`
      : formatDatePart(span.startDate, season)
  return span.time === null ? days : `${days} · ${formatTimeSlot(span.time)}`
}

/** The days and half a planned occasion's When pill reads: `"Mar 7 to Mar 8 · Night"`. */
function shortWhenOf(planned: PlannedOccasion, season: Season): string {
  const start = formatShortGameDate(planned.startDate, season)
  const days =
    planned.endDate > planned.startDate
      ? `${start} to ${formatShortGameDate(planned.endDate, season)}`
      : start
  return `${days} · ${planned.time === null ? 'All day' : formatTimeSlot(planned.time)}`
}

/** Keeps `patch` over the fixed occasion `id`'s changes as they are typed or picked. */
function writeFixed(id: string, patch: FixedOccasionEdit): void {
  updateApplication((d) => {
    const fixedEdits = withFixedEdit(d.season, d.fixedEdits, id, patch)
    if (fixedEdits === d.fixedEdits) return d
    const { fixedEdits: _before, ...rest } = d
    return fixedEdits ? { ...rest, fixedEdits } : rest
  })
}

/**
 * One row of the list: a fixed occasion as the semester has it, one taken off the semester, or one
 * the semester invents.
 */
type OccasionItem =
  | { key: string; fixed: Occasion; removed: boolean; start: number; half: number }
  | { key: string; planned: PlannedOccasion; start: number; half: number }

/** The fixed occasions, those taken off and the planned ones, in date order and then by half. */
function itemsOf(
  plan: readonly PlannedOccasion[],
  fixed: readonly Occasion[],
  removed: readonly Occasion[]
): OccasionItem[] {
  const fixedItem = (occasion: Occasion, gone: boolean): OccasionItem => ({
    key: `fixed:${occasion.id}`,
    fixed: occasion,
    removed: gone,
    start: occasion.startDate,
    half: occasion.time ?? -1
  })
  const items: OccasionItem[] = [
    ...fixed.map((occasion) => fixedItem(occasion, false)),
    ...removed.map((occasion) => fixedItem(occasion, true)),
    ...plan.map((planned) => ({
      key: `plan:${planned.id}`,
      planned,
      start: planned.startDate,
      half: planned.time ?? -1
    }))
  ]
  return items.sort((a, b) => a.start - b.start || a.half - b.half)
}

/** The items under one month's heading each, in order. */
function monthsOf(items: readonly OccasionItem[], season: Season): { month: string; items: OccasionItem[] }[] {
  const months: { month: string; items: OccasionItem[] }[] = []
  for (const item of items) {
    const month = monthName(item.start, season)
    const last = months[months.length - 1]
    if (last && last.month === month) last.items.push(item)
    else months.push({ month, items: [item] })
  }
  return months
}

/** The rows of the screen as an application has them. */
function itemsOfDraft(draft: Pick<ApplicationDraft, 'season' | 'plan' | 'fixedEdits'>): OccasionItem[] {
  const edits = draft.fixedEdits ?? {}
  return itemsOf(
    draft.plan,
    fixedOccasionsOf(draft.season, edits),
    removedFixedOccasionsOf(draft.season, edits)
  )
}

/** The row a pick opens: the pick, or the first invented occasion where it is gone or nothing is picked yet. */
function openItemOf(items: readonly OccasionItem[], picked: string | null): OccasionItem | undefined {
  return (
    items.find((item) => item.key === picked) ??
    items.find((item) => 'planned' in item) ??
    items[0]
  )
}

/**
 * A modal the Occasions screen raises over itself: a day or the days to pick, a fixed occasion's
 * reset, or an occasion's delete.
 */
export type OccasionModal =
  | { kind: 'fixed-date'; id: string }
  | { kind: 'slots'; id: string }
  | { kind: 'reset'; id: string }
  | { kind: 'delete'; id: string; fixed: boolean }

/** A quiet button at the foot of the pane. */
function PaneAction({
  id,
  children,
  onPress
}: {
  id: string
  children: ReactNode
  onPress: () => void
}): JSX.Element {
  return (
    <motion.button
      id={id}
      className="vu-btn vu-btn--quiet"
      type="button"
      {...gestures(false, quietLift, quietPress)}
      onClick={onPress}
    >
      {children}
    </motion.button>
  )
}

/**
 * A fixed occasion open in the pane: its words to change, the build's shown while a box is blank,
 * the day it starts on and its delete where it may move, and a reset while anything stands
 * changed; one taken off the semester shows only when it was and its restore.
 */
function FixedPane({
  occasion,
  removed,
  season,
  onOpen
}: {
  occasion: Occasion
  removed: boolean
  season: Season
  onOpen: (modal: OccasionModal) => void
}): JSX.Element | null {
  const { id } = occasion
  const edit = useApplicationStore((s) => s.application?.fixedEdits?.[id])
  const edited = useApplicationStore((s) =>
    fixedOccasionEdited(season, s.application?.fixedEdits, id)
  )
  const shipped = staticOccasionsOf(season).find((entry) => entry.id === id)
  if (!shipped) return null

  const head = (
    <div className="vu-entries-head">
      <h2 className="vu-entries-heading">{occasion.title}</h2>
      <p className="vu-entries-when">{whenOf(occasion, season)}</p>
    </div>
  )

  if (removed) {
    return (
      <>
        {head}
        <div className="vu-entries-actions">
          <PaneAction id="occasion-fixed-restore" onPress={() => writeFixed(id, { removed: undefined })}>
            Restore occasion
          </PaneAction>
        </div>
      </>
    )
  }

  const movable = fixedOccasionMovable(season, id)
  return (
    <>
      {head}
      <div className="vu-entries-fields">
        <TextField
          id="occasion-fixed-title"
          label="Title"
          value={edit?.title ?? shipped.title}
          placeholder={shipped.title}
          maxLength={80}
          onChange={(value) => writeFixed(id, { title: value })}
        />
        <TextField
          id="occasion-fixed-description"
          label="Description"
          value={edit?.description ?? shipped.description}
          placeholder={shipped.description}
          multiline
          autoGrow
          onChange={(value) => writeFixed(id, { description: value })}
        />
        {movable && (
          <div className="vu-entries-grid">
            <DatePill
              id="occasion-fixed-date"
              label={occasion.endDate > occasion.startDate ? 'Starts' : 'Date'}
              date={occasion.startDate}
              season={season}
              onPick={() => onOpen({ kind: 'fixed-date', id })}
            />
          </div>
        )}
      </div>
      {(edited || movable) && (
        <div className="vu-entries-actions">
          {edited && (
            <PaneAction id="occasion-fixed-reset" onPress={() => onOpen({ kind: 'reset', id })}>
              Reset to default
            </PaneAction>
          )}
          {movable && (
            <PaneAction
              id="occasion-fixed-delete"
              onPress={() => onOpen({ kind: 'delete', id, fixed: true })}
            >
              Delete occasion
            </PaneAction>
          )}
        </div>
      )}
    </>
  )
}

/**
 * A planned occasion open in the pane: its kind, days and purpose, the words for it, its kind
 * and when to change, and its delete.
 */
function PlannedPane({
  planned,
  season,
  onOpen,
  onPick
}: {
  planned: PlannedOccasion
  season: Season
  onOpen: (modal: OccasionModal) => void
  onPick: (key: string) => void
}): JSX.Element {
  const id = planned.id
  const entry = useApplicationStore((s) => s.application?.occasions[id])
  const kind = plannedKindOf(planned)

  /** Writes one of its two fields as typed, the other as it stands. */
  const write = (field: keyof OccasionEntry, value: string): void =>
    updateApplication((d) => {
      const before = d.occasions[id]
      const words: OccasionEntry = {
        title: before?.title ?? '',
        description: before?.description ?? '',
        [field]: value
      }
      const occasions = withOccasionWords(d.occasions, id, words)
      return occasions === d.occasions ? d : { ...d, occasions }
    })

  return (
    <>
      <div className="vu-entries-head vu-entries-head--stickered">
        <span className="vu-sticker vu-entries-sticker">{OCCASION_KIND_WORDS[kind]}</span>
        <p className="vu-entries-when">{whenOf(planned, season)}</p>
        <p className="vu-entries-text">{purposeOf(planned, season)}</p>
      </div>
      <div className="vu-entries-fields">
        <TextField
          id="occasion-title"
          label="Title"
          value={entry?.title ?? ''}
          placeholder={BLANK}
          maxLength={80}
          onChange={(value) => write('title', value)}
        />
        <TextField
          id="occasion-description"
          label="Description"
          value={entry?.description ?? ''}
          placeholder={BLANK}
          multiline
          autoGrow
          onChange={(value) => write('description', value)}
        />
        <div className="vu-entries-grid">
          <SelectField
            id="occasion-kind"
            label="Kind"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(value) => onPick(`plan:${retypeOccasion(id, value as OccasionKind)}`)}
          />
          <DatePill
            id="occasion-when"
            label="When"
            date={planned.startDate}
            season={season}
            reading={shortWhenOf(planned, season)}
            onPick={() => onOpen({ kind: 'slots', id })}
          />
        </div>
      </div>
      <div className="vu-entries-actions">
        <PaneAction id="occasion-delete" onPress={() => onOpen({ kind: 'delete', id, fixed: false })}>
          Delete occasion
        </PaneAction>
      </div>
    </>
  )
}

/**
 * New Game's Occasions screen: the semester's occasions down the list column by month, the
 * fixed ones muted, an edited one marked and one taken off the semester marked as deleted, and
 * the one picked open beside it on its fields — a fixed one's words and day, an invented one's
 * title, description, kind, days and half.
 */
export const NewGameOccasions = memo(function NewGameOccasions({
  picked,
  onPick,
  onOpen
}: {
  picked: string | null
  onPick: (key: string) => void
  onOpen: (modal: OccasionModal) => void
}): JSX.Element | null {
  const season = useApplicationStore((s) => s.application?.season)
  const plan = useApplicationStore((s) => s.application?.plan)
  const occasions = useApplicationStore((s) => s.application?.occasions)
  const fixedEdits = useApplicationStore((s) => s.application?.fixedEdits)

  const items = useMemo(
    () => (season && plan ? itemsOfDraft({ season, plan, fixedEdits }) : []),
    [season, plan, fixedEdits]
  )
  if (!season || !plan || !occasions) return null

  const open = openItemOf(items, picked)

  const side = monthsOf(items, season).map(({ month, items: rows }) => (
    <EntrySection key={month} title={month}>
      {rows.map((item) => {
        const on = item === open
        if ('fixed' in item) {
          const sticker = item.removed
            ? 'Deleted'
            : fixedOccasionEdited(season, fixedEdits, item.fixed.id)
              ? 'Edited'
              : undefined
          return (
            <EntryRow
              key={item.key}
              id={`occasion-fixed-${item.fixed.id}`}
              title={item.fixed.title}
              reading={formatShortGameDate(item.start, season)}
              muted
              sticker={sticker}
              on={on}
              onOpen={() => onPick(item.key)}
            />
          )
        }
        const entry = occasions[item.planned.id]
        return (
          <EntryRow
            key={item.key}
            id={`occasion-row-${item.planned.id}`}
            title={plannedTitleOf(item.planned, entry)}
            reading={formatShortGameDate(item.start, season)}
            warn={entryTouched(entry) && !occasionFilled(entry)}
            on={on}
            onOpen={() => onPick(item.key)}
          />
        )
      })}
    </EntrySection>
  ))

  let pane: ReactNode = null
  if (open && 'fixed' in open) {
    pane = <FixedPane occasion={open.fixed} removed={open.removed} season={season} onOpen={onOpen} />
  } else if (open) {
    pane = <PlannedPane planned={open.planned} season={season} onOpen={onOpen} onPick={onPick} />
  }

  return <EntriesPanel side={side} pane={pane} paneKey={open?.key} />
})

/**
 * The semester's calendar as the screen stands, for a picker to label: the fixed occasions as
 * changed and the planned ones under their titles or kinds, less the planned one `except` names.
 */
function pickerCalendarOf(draft: ApplicationDraft, except?: string): SemesterCalendar {
  const planned = draft.plan
    .filter((entry) => entry.id !== except)
    .map((entry) =>
      occasionOf(entry, { title: plannedTitleOf(entry, draft.occasions[entry.id]), description: '' })
    )
  return calendarOf(draft.season, planned, draft.fixedEdits ?? {})
}

/** The picker a modal asks for, or null where what it names is gone. */
function Picker({
  modal,
  draft,
  theme,
  onClose
}: {
  modal: Extract<OccasionModal, { kind: 'fixed-date' | 'slots' }>
  draft: ApplicationDraft
  theme: ScreenTheme
  onClose: () => void
}): JSX.Element | null {
  const { season } = draft
  if (modal.kind === 'fixed-date') {
    const occasion = fixedOccasionsOf(season, draft.fixedEdits ?? {}).find(
      (entry) => entry.id === modal.id
    )
    if (!occasion) return null
    return (
      <DatePickerModal
        theme={theme}
        id="occasion-date-picker"
        season={season}
        occasions
        calendar={pickerCalendarOf(draft)}
        onClose={onClose}
        date={occasion.startDate}
        first={OCCASION_FIRST_DAY}
        last={OCCASION_LAST_DAY - (occasion.endDate - occasion.startDate)}
        allows={(day) => fixedOccasionMoves(season, modal.id, day)}
        onPick={(day) => writeFixed(modal.id, { startDate: day })}
      />
    )
  }
  const planned = draft.plan.find((entry) => entry.id === modal.id)
  if (!planned) return null
  return (
    <SlotPickerModal
      theme={theme}
      id="occasion-slot-picker"
      span={{ startDate: planned.startDate, endDate: planned.endDate, time: planned.time }}
      first={OCCASION_FIRST_DAY}
      last={OCCASION_LAST_DAY}
      season={season}
      calendar={pickerCalendarOf(draft, planned.id)}
      onPick={(span) => moveOccasion(modal.id, span)}
      onClose={onClose}
    />
  )
}

/**
 * What an occasions import said that the player should hear, as a notice's title and words; a
 * later semester's New Game is named New Game+.
 */
function noticeOf(outcome: ImportOutcome, continued: boolean): { title: string; message: string } {
  if (outcome.status === 'season') {
    return {
      title: "Couldn't import occasions",
      message: `These occasions are for a ${outcome.season} semester, and this ${continued ? 'New Game+' : 'New Game'} is a ${outcome.season === 'spring' ? 'fall' : 'spring'} semester.`
    }
  }
  if (outcome.status === 'empty') {
    return { title: "Couldn't import occasions", message: 'None of the occasions in this file could be used.' }
  }
  const { imported: n, leftOut: m } = outcome
  return {
    title: 'Occasions imported',
    message: `${n} ${n === 1 ? 'occasion was' : 'occasions were'} imported. ${m} ${m === 1 ? 'was' : 'were'} left out because the game couldn't use ${m === 1 ? 'it' : 'them'}.`
  }
}

/** Whether an import's outcome is worth a notice: a refusal, or something left out. */
function worthNotice(outcome: ImportOutcome): boolean {
  return outcome.status !== 'imported' || outcome.leftOut > 0
}

/**
 * The Occasions screen's controls and modals: the row the pane has open, New occasion for the
 * title row, the file tools for the frame's foot — Import, Export, and Clear while anything is
 * written or changed — with the confirms and the notice they raise, the pickers, a fixed
 * occasion's reset and an occasion's delete, one after another in one presence. `covered` while
 * any of those stands.
 */
export function useOccasionModals(
  theme: ScreenTheme,
  dead: boolean
): {
  picked: string | null
  pick: (key: string) => void
  controls: ReactNode
  tools: ReactNode
  open: (modal: OccasionModal) => void
  modals: ReactNode
  covered: boolean
} {
  const draft = useApplicationStore((s) => s.application)
  const written = useApplicationStore((s) => {
    const application = s.application
    if (!application) return false
    return (
      application.planChanged === true ||
      Object.values(application.occasions).some(entryTouched) ||
      Object.keys(keptFixedEdits(application.season, application.fixedEdits ?? {})).length > 0
    )
  })
  const replans = useApplicationStore(
    (s) => s.application?.planChanged === true || s.application?.fixedEdits !== undefined
  )
  const addable = useApplicationStore((s) => (s.application ? canAddOccasion(s.application) : false))
  const continued = draft?.continued !== undefined
  const onScreen = useApplicationStore((s) => s.application?.screen === 'occasions')
  const [picked, setPicked] = useState<string | null>(null)
  // The screen opens afresh on its first invented occasion each time it is entered.
  if (!onScreen && picked !== null) setPicked(null)
  const [asking, setAsking] = useState<'import' | 'clear' | null>(null)
  const [notice, setNotice] = useState<ImportOutcome | null>(null)
  const [modal, setModal] = useState<OccasionModal | null>(null)
  const [pending, setPending] = useState(false)

  /** Opens the picker inside the click that asked for it, and raises a notice where one is owed. */
  const runImport = (): void => {
    setPending(true)
    void importOccasions().then(
      (outcome) => {
        setPending(false)
        if (outcome && worthNotice(outcome)) setNotice(outcome)
      },
      () => setPending(false)
    )
  }

  /** Adds a small event on the first free day from the open row's on, and opens it. */
  const add = (): void => {
    const now = useApplicationStore.getState().application
    if (!now) return
    const open = openItemOf(itemsOfDraft(now), picked)
    const id = addOccasion(open?.start ?? OCCASION_FIRST_DAY)
    if (id) setPicked(`plan:${id}`)
  }

  const addDead = dead || !addable
  const controls = (
    <motion.button
      id="new-game-occasions-new"
      className="vu-pill"
      type="button"
      disabled={addDead}
      {...gestures(addDead, quietLift, quietPress)}
      onClick={add}
    >
      <PlusIcon size={14} />
      New occasion
    </motion.button>
  )

  const pillDead = dead || pending
  const tools = (
    <>
      <motion.button
        id="new-game-occasions-import"
        className="vu-pill"
        type="button"
        disabled={pillDead}
        {...gestures(pillDead, quietLift, quietPress)}
        onClick={() => setAsking('import')}
      >
        <UploadIcon size={14} ariaHidden />
        Import
      </motion.button>
      <motion.button
        id="new-game-occasions-export"
        className="vu-pill"
        type="button"
        disabled={pillDead}
        {...gestures(pillDead, quietLift, quietPress)}
        onClick={() => void exportOccasions()}
      >
        <DownloadIcon size={14} ariaHidden />
        Export
      </motion.button>
      {written && (
        <motion.button
          id="new-game-occasions-clear"
          className="vu-pill"
          type="button"
          disabled={pillDead}
          {...gestures(pillDead, quietLift, quietPress)}
          onClick={() => setAsking('clear')}
        >
          Clear
        </motion.button>
      )}
    </>
  )

  const close = (): void => setModal(null)
  const shown = notice ? noticeOf(notice, continued) : null
  const modals = (
    <AnimatePresence mode="wait">
      {asking === 'import' ? (
        <ConfirmModal
          key="occasions-import"
          id="new-game-occasions-import-confirm"
          theme={theme}
          title="Import occasions?"
          message="The occasions in the file will replace every occasion on this screen and everything written for them."
          confirmText="Import"
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null)
            // Inside the click, so a browser's file picker is allowed to open.
            runImport()
          }}
        />
      ) : asking === 'clear' ? (
        <ConfirmModal
          key="occasions-clear"
          id="new-game-occasions-clear-confirm"
          theme={theme}
          title="Clear occasions?"
          message={
            replans
              ? "Everything you've written for the occasions and every change you've made to them will be permanently deleted, and a new set of occasions will be scheduled."
              : "Everything you've written for the occasions will be permanently deleted."
          }
          confirmText="Clear"
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null)
            clearOccasions()
          }}
        />
      ) : shown ? (
        <ConfirmModal
          key="occasions-notice"
          id="new-game-occasions-notice"
          theme={theme}
          title={shown.title}
          message={shown.message}
          confirmText="Okay"
          onConfirm={() => setNotice(null)}
        />
      ) : modal?.kind === 'reset' ? (
        <ConfirmModal
          key="occasion-reset"
          id="occasion-fixed-reset-confirm"
          theme={theme}
          title="Reset to default?"
          message="Your edits to this occasion will be permanently deleted."
          confirmText="Reset"
          onCancel={close}
          onConfirm={() => {
            resetFixedOccasion(modal.id)
            close()
          }}
        />
      ) : modal?.kind === 'delete' ? (
        <ConfirmModal
          key="occasion-delete"
          id="occasion-delete-confirm"
          theme={theme}
          title="Delete this occasion?"
          message={
            modal.fixed
              ? "You can restore it later by clicking on it."
              : 'This occasion will be permanently deleted.'
          }
          confirmText="Delete occasion"
          onCancel={close}
          onConfirm={() => {
            if (modal.fixed) writeFixed(modal.id, { removed: true })
            else deleteOccasion(modal.id)
            close()
          }}
        />
      ) : modal && draft ? (
        <Picker key="occasion-picker" modal={modal} draft={draft} theme={theme} onClose={close} />
      ) : null}
    </AnimatePresence>
  )

  return {
    picked,
    pick: setPicked,
    controls,
    tools,
    open: setModal,
    modals,
    covered: asking !== null || notice !== null || modal !== null
  }
}
