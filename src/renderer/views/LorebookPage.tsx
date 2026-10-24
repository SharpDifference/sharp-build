import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { editOf, loreKeysProblem, loreTextProblem } from '@shared/lorebookRecord'
import { allBackgrounds } from '@shared/types'
import { BgSlot } from '../components/BgSlot'
import { CheckField } from '../components/CheckField'
import { ChipListInput } from '../components/ChipListInput'
import { ConfirmModal } from '../components/ConfirmModal'
import { TextField } from '../components/TextField'
import type { BookEntry } from '../prompts/lorebook'
import { SETTING } from '../prompts/setting'
import { useAssetStore } from '../stores/assetStore'
import { useLorebookStore, type ImportOutcome } from '../stores/lorebookStore'
import { BgPicker } from './BgModal'
import { bgThumbUrl } from './bgAssets'
import { dealt, gestures, quietLift, quietPress, rowLift, rowPress, slideInQuick } from './motion'
import { PlusIcon } from './screenIcons'
import { TextEditModal } from './TextEditModal'
import '../vu_styles/Lorebook.css'

export interface LorebookPageProps {
  theme: 'day' | 'night'
}

/** The list dealing itself in, on the tab pages' own clock. Module scope. */
const LIST_DEAL = dealt(0, 0.02)

/** What the import question says it will do, by whether the replace box is ticked. */
const IMPORT_SIZE = 'Large lorebooks may slow the game down or cause context bloat.'
const IMPORT_REPLACE_NOTE =
  "By default, lorebook entries will be added to this playthrough's lorebook. When this box is checked, lorebook entries and the setting will be replaced instead. Changes to the setting and default entries present in your lorebook will be ignored when this box is unchecked."

/** What an import brought in, and what it left out and why. */
function importNotice({ imported, leftOut }: ImportOutcome): string {
  const came = `${String(imported)} ${imported === 1 ? 'entry was' : 'entries were'} imported.`
  const why = leftOut === 1 ? 'it was' : 'they were'
  return `${came} ${String(leftOut)} ${leftOut === 1 ? 'was' : 'were'} left out because ${why} turned off or had no trigger word or description the game can use.`
}

/** The playthrough's setting, opened for hand-editing over the Lorebook tab. */
function SettingModal({
  theme,
  onClose
}: {
  theme: 'day' | 'night'
  onClose: () => void
}): JSX.Element | null {
  const setting = useLorebookStore((s) => s.setting)
  return (
    <TextEditModal
      theme={theme}
      id="setting-modal"
      idPrefix="setting"
      title="Edit setting"
      label="Setting"
      discardMessage="The setting has not been saved."
      stored={setting}
      shipped={SETTING}
      save={(value) => useLorebookStore.getState().editSetting(value)}
      onClose={onClose}
    />
  )
}

/** What the editor beside the list is open on: an entry by its handle, or a new one. */
type Selection = { handle: string } | { draft: true }

/** One entry in the list: its first trigger word, and a sticker where the player changed it. */
function LoreRow({
  id,
  title,
  on,
  edited,
  onOpen
}: {
  id: string
  title: string
  on: boolean
  edited: boolean
  onOpen: () => void
}): JSX.Element {
  return (
    <motion.li className="vu-lore-item" variants={slideInQuick}>
      <motion.button
        id={id}
        className={`vu-row vu-lore-row${on ? ' vu-lore-row--on' : ''}`}
        type="button"
        aria-pressed={on}
        {...gestures(false, rowLift, rowPress)}
        onClick={onOpen}
      >
        <span className="vu-bb-name vu-lore-title">{title}</span>
      </motion.button>
      {edited && <span className="vu-sticker vu-lore-sticker">Edited</span>}
    </motion.li>
  )
}

/** The pane beside the list while no entry is open in it; silent while there is none to pick. */
function LoreBlank({ ready }: { ready: boolean }): JSX.Element {
  return (
    <div className="vu-bb-thread vu-bb-thread--blank">
      {ready && <p className="vu-empty vu-empty--flush">Pick an entry on the left to edit it.</p>}
    </div>
  )
}

/**
 * One entry open for editing, saved as it goes: the trigger words and the background the moment
 * they change, the description when its box is left, and whatever is still held when the editor
 * goes away. A value that cannot be kept is held in its box and named on the status line; the
 * entry keeps its last good one. A new entry is made once it has a trigger word and a description.
 */
function LoreEditor({
  entry,
  revision,
  theme,
  onCreated,
  onReset,
  onDelete
}: {
  /** Null for a new entry not made yet. */
  entry: BookEntry | null
  revision: number
  theme: 'day' | 'night'
  onCreated: (id: string) => void
  onReset: () => void
  onDelete: () => void
}): JSX.Element {
  const backgrounds = useAssetStore((s) => s.backgrounds)
  const edited = useLorebookStore((s) =>
    entry && !entry.custom ? editOf(s.record, entry.handle) !== undefined : false
  )

  const [keys, setKeys] = useState<readonly string[]>(entry?.keys ?? [])
  const [text, setText] = useState(entry?.text ?? '')
  const [bg, setBg] = useState<string | undefined>(entry?.bg)
  const [typing, setTyping] = useState('')
  const [pickingBg, setPickingBg] = useState(false)

  // What the leave-commit reads, the editor being gone by the time it runs.
  const handleRef = useRef<string | null>(entry?.handle ?? null)
  const keysRef = useRef(keys)
  const textRef = useRef(text)
  const bgRef = useRef(bg)
  const typingRef = useRef('')

  const shipped = entry !== null && !entry.custom

  /** Keeps whatever of `patch` can be kept; a new entry is made once it has both halves. */
  const save = (patch: { keys?: readonly string[]; text?: string; bg?: string | null }): void => {
    const store = useLorebookStore.getState()
    const handle = handleRef.current
    if (handle === null) {
      const fields = { keys: patch.keys ?? keysRef.current, text: patch.text ?? textRef.current }
      if (loreKeysProblem(fields.keys) || loreTextProblem(fields.text)) return
      const made = store.createCustom(
        { ...fields, ...(bgRef.current !== undefined ? { bg: bgRef.current } : {}) },
        revision
      )
      if (made) {
        handleRef.current = made
        onCreated(made)
      }
      return
    }
    if (shipped) {
      // A shipped entry's background is the build's, never the player's.
      if (patch.keys === undefined && patch.text === undefined) return
      store.editShipped(
        handle,
        {
          ...(patch.keys !== undefined ? { keys: [...patch.keys] } : {}),
          ...(patch.text !== undefined ? { text: patch.text } : {})
        },
        revision
      )
      return
    }
    store.updateCustom(handle, patch, revision)
  }

  /** The trigger words as they stand, the one still being typed among them. */
  const keysWithTyping = (): readonly string[] =>
    typingRef.current.trim() ? [...keysRef.current, typingRef.current] : keysRef.current

  // Whatever is still held when the editor goes away — another entry picked, another tab, the
  // phone closed with the caret still in a box — is kept where it can be.
  useEffect(
    () => () => {
      const words = keysWithTyping()
      save({
        ...(loreKeysProblem(words) ? {} : { keys: words }),
        ...(loreTextProblem(textRef.current) ? {} : { text: textRef.current })
      })
    },
    []
  )

  const listed = new Set(allBackgrounds(backgrounds))
  // A background since deleted is no background at all, here as in the prompt.
  const shownBg = bg !== undefined && listed.has(bg) ? bg : undefined
  const problem =
    loreKeysProblem(typing.trim() ? [...keys, typing] : keys) ?? loreTextProblem(text)

  return (
    <div className="vu-lore-pane">
      <div className="vu-bb-scroll vu-lore-fields">
        <label className="vu-field" htmlFor="lore-keys">
          <span className="vu-field-label">Trigger words</span>
          <span className="vu-field-hint">
            When one of the trigger words appears in context, the lorebook entry will be pulled into memory.
          </span>
          <ChipListInput
            id="lore-keys"
            phrases
            values={keys}
            placeholder="Enter or comma to add a trigger word"
            autoFocus={entry === null}
            onDraft={(draft) => {
              typingRef.current = draft
              setTyping(draft)
            }}
            onChange={(next) => {
              setKeys(next)
              keysRef.current = next
              if (!loreKeysProblem(next)) save({ keys: next })
            }}
          />
        </label>

        <TextField
          id="lore-text"
          label="Description"
          placeholder="<Name> is a..."
          value={text}
          multiline
          autoGrow
          rows={6}
          onChange={(next) => {
            setText(next)
            textRef.current = next
          }}
          onBlur={() => {
            if (!loreTextProblem(textRef.current)) save({ text: textRef.current })
          }}
        />

        {shipped ? (
          entry.bg !== undefined && (
            <div className="vu-field">
              <span className="vu-field-label">Associated BG</span>
              <span id="lore-bg-reading" className="vu-lore-bg-reading">
                {entry.bg}
              </span>
            </div>
          )
        ) : (
          <div className="vu-field">
            <span className="vu-field-label">Associated BG</span>
            <span className="vu-field-hint">
              If your entry is a location, you can select a BG name to be injected into memory with the entry.
            </span>
            <BgSlot
              idPrefix="lore"
              src={shownBg !== undefined ? bgThumbUrl(shownBg, theme, false) : null}
              picked={shownBg !== undefined}
              onPick={() => setPickingBg(true)}
              onClear={() => {
                setBg(undefined)
                bgRef.current = undefined
                save({ bg: null })
              }}
            />
          </div>
        )}
      </div>

      <div className="vu-foot-stack">
        <span id="lore-status" className="vu-form-status">
          {problem !== null && (
            <>
              <span className="vu-form-dot vu-form-dot--warn" />
              {problem}
            </>
          )}
        </span>
        <div className="vu-foot">
          {shipped && edited && (
            <motion.button
              id="lore-reset"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={onReset}
            >
              Reset to default
            </motion.button>
          )}
          {entry !== null && entry.custom && (
            <motion.button
              id="lore-delete"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={onDelete}
            >
              Delete entry
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence propagate>
        {pickingBg && (
          <BgPicker
            key="lore-bg"
            theme={theme}
            half={theme}
            wet={false}
            withRooms={false}
            title="Associated BG"
            label="Where the writer sets a scene this entry is about"
            picked={shownBg ?? null}
            onPick={(id) => {
              setBg(id)
              bgRef.current = id
              save({ bg: id })
              setPickingBg(false)
            }}
            onClose={() => setPickingBg(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The Bunnyboard's Lorebook tab: the playthrough's own entries and the shipped ones down a list,
 * the one picked open for editing beside it, the setting opened over it from a pill, and the
 * lorebook's way in and out as a SillyTavern World Info file.
 */
export function LorebookPage({ theme }: LorebookPageProps): JSX.Element {
  const status = useLorebookStore((s) => s.status)
  const book = useLorebookStore((s) => s.book)
  const record = useLorebookStore((s) => s.record)
  const revision = useLorebookStore((s) => s.revision)

  const [selected, setSelected] = useState<Selection | null>(null)
  /** Moved on for every entry opened, so the editor starts afresh on each. */
  const [session, setSession] = useState(0)
  const [importing, setImporting] = useState(false)
  const [replace, setReplace] = useState(false)
  const [notice, setNotice] = useState<ImportOutcome | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingSetting, setEditingSetting] = useState(false)

  const ready = status === 'ready'
  const refused = status === 'refused'
  const own = book.filter((entry) => entry.custom)
  const shipped = book.filter((entry) => !entry.custom)

  const open = (next: Selection): void => {
    // The entry already open stays as it is.
    if (selected && 'handle' in next && 'handle' in selected && next.handle === selected.handle) {
      return
    }
    setSelected(next)
    setSession((count) => count + 1)
  }

  // An entry an import or a delete took away leaves the pane blank.
  const current =
    selected && 'handle' in selected
      ? (book.find((entry) => entry.handle === selected.handle) ?? null)
      : null
  const drafting = selected !== null && 'draft' in selected
  useEffect(() => {
    if (selected && 'handle' in selected && !current) setSelected(null)
  }, [selected, current])

  return (
    <>
      <div className="vu-bb-side vu-lore-side">
        <div className="vu-title vu-bb-title">
          <h2 className="vu-title-text">Lorebook</h2>
        </div>

        {refused ? (
          <p className="vu-empty vu-empty--flush">
            This playthrough&apos;s lorebook could not be read, so scenes use the default one.
          </p>
        ) : (
          <>
            {ready && (
              <div className="vu-lore-heads">
                <motion.button
                  id="lore-new"
                  className="vu-pill"
                  type="button"
                  {...gestures(false, quietLift, quietPress)}
                  onClick={() => open({ draft: true })}
                >
                  <PlusIcon size={14} />
                  New entry
                </motion.button>
                <div className="vu-lore-setting">
                  <motion.button
                    id="lore-setting"
                    className="vu-pill"
                    type="button"
                    {...gestures(false, quietLift, quietPress)}
                    onClick={() => setEditingSetting(true)}
                  >
                    Edit setting
                  </motion.button>
                  {record.setting !== undefined && (
                    <span className="vu-sticker vu-lore-sticker">Edited</span>
                  )}
                </div>
              </div>
            )}
            <div className="vu-bb-scroll vu-lore-scroll">
              {(own.length > 0 || drafting) && (
                <>
                  <div className="vu-bb-section">Your entries · {own.length}</div>
                  <motion.ul
                    className="vu-rows"
                    variants={LIST_DEAL}
                    initial="hidden"
                    animate="shown"
                  >
                    {drafting && (
                      <LoreRow
                        id="lore-row-draft"
                        title="New entry"
                        on
                        edited={false}
                        onOpen={() => {}}
                      />
                    )}
                    {own.map((entry) => (
                      <LoreRow
                        key={entry.handle}
                        id={`lore-row-${entry.handle}`}
                        title={entry.keys[0]}
                        on={current?.handle === entry.handle}
                        edited={false}
                        onOpen={() => open({ handle: entry.handle })}
                      />
                    ))}
                  </motion.ul>
                </>
              )}
              <div className="vu-bb-section">Venus University · {shipped.length}</div>
              <motion.ul className="vu-rows" variants={LIST_DEAL} initial="hidden" animate="shown">
                {shipped.map((entry) => (
                  <LoreRow
                    key={entry.handle}
                    id={`lore-row-${entry.handle}`}
                    title={entry.keys[0]}
                    on={current?.handle === entry.handle}
                    edited={editOf(record, entry.handle) !== undefined}
                    onOpen={() => open({ handle: entry.handle })}
                  />
                ))}
              </motion.ul>
            </div>
          </>
        )}

        <div className="vu-lore-tools">
          {(ready || refused) && (
            <motion.button
              id="lore-import"
              className="vu-pill"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => {
                setReplace(refused)
                setImporting(true)
              }}
            >
              Import
            </motion.button>
          )}
          {ready && (
            <motion.button
              id="lore-export"
              className="vu-pill"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => void useLorebookStore.getState().exportWorld()}
            >
              Export
            </motion.button>
          )}
        </div>
      </div>

      {ready && (current || drafting) ? (
        <LoreEditor
          key={`${revision}:${session}`}
          entry={current}
          revision={revision}
          theme={theme}
          onCreated={(id) => setSelected({ handle: id })}
          onReset={() => current && setResetting(current.handle)}
          onDelete={() => current && setDeleting(current.handle)}
        />
      ) : (
        <LoreBlank ready={ready} />
      )}

      <AnimatePresence propagate mode="wait">
        {importing ? (
          <ConfirmModal
            key="lore-import"
            id="lore-import-confirm"
            theme={theme}
            title="Import a lorebook?"
            message={[IMPORT_SIZE]}
            aside={
              <CheckField
                id="lore-import-replace"
                label="Replace current lorebook"
                note={IMPORT_REPLACE_NOTE}
                checked={replace}
                disabled={refused}
                onChange={setReplace}
              />
            }
            confirmText="Import"
            onCancel={() => setImporting(false)}
            onConfirm={() => {
              setImporting(false)
              // Called inside the click, so a browser's file picker is allowed to open.
              void useLorebookStore
                .getState()
                .importWorld(replace)
                .then((outcome) => {
                  if (!outcome) return
                  setSelected(null)
                  if (outcome.leftOut > 0) setNotice(outcome)
                })
            }}
          />
        ) : notice ? (
          <ConfirmModal
            key="lore-notice"
            id="lore-import-notice"
            theme={theme}
            title="Lorebook imported"
            message={importNotice(notice)}
            confirmText="Okay"
            onConfirm={() => setNotice(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence propagate>
        {resetting && (
          <ConfirmModal
            key="lore-reset"
            id="lore-reset-confirm"
            theme={theme}
            title="Reset to default?"
            message="Your edits to this entry will be permanently deleted."
            confirmText="Reset"
            onCancel={() => setResetting(null)}
            onConfirm={() => {
              useLorebookStore.getState().resetShipped(resetting)
              setResetting(null)
            }}
          />
        )}
        {editingSetting && (
          <SettingModal key="lore-setting" theme={theme} onClose={() => setEditingSetting(false)} />
        )}
        {deleting && (
          <ConfirmModal
            key="lore-delete"
            id="lore-delete-confirm"
            theme={theme}
            title="Delete this entry?"
            message="The entry is permanently deleted."
            confirmText="Delete entry"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              useLorebookStore.getState().deleteCustom(deleting)
              setDeleting(null)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
