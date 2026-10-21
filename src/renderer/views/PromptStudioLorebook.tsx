/**
 * Prompt Studio's Lorebook tab: the game's own lorebook as the player has edited it, and the
 * books of their own, with the panels it opens over itself. Every change is written as it is
 * confirmed, and takes effect on the next request.
 */
import { useRef, useState, type JSX } from 'react'
import { AnimatePresence } from 'motion/react'
import { importWorldInfo, type WorldInfoNote, type WorldInfoReport } from '@shared/lorebooks/importWorldInfo'
import {
  MAX_LORE_KEY_LENGTH,
  MAX_LORE_KEYS,
  MAX_LORE_NAME_LENGTH,
  MAX_LORE_TEXT_LENGTH
} from '@shared/lorebooks/rules'
import type {
  LoreBook,
  LoreBookEntry,
  ShippedLoreOverride,
  ShippedLoreOverrides
} from '@shared/lorebooks/types'
import { CheckField } from '../components/CheckField'
import { ConfirmModal } from '../components/ConfirmModal'
import { TextField } from '../components/TextField'
import { SHIPPED_LORE, type LoreEntry } from '../prompts/lorebook'
import { useLoreStore } from '../stores/loreStore'
import { useUiStore } from '../stores/uiStore'
import type { ScreenTheme } from './clockTheme'
import { useStudioBackup } from './PromptStudioBackup'
import { FormFrame, StudioPill } from './PromptStudioModals'
import '../vu_styles/PromptStudio.css'

/** The most rows an import report lists under one heading. */
const REPORT_ROWS = 40

/** What each kind of book is called beside its name. */
const SOURCE_WORDS = { native: 'Your own', sillytavern: 'SillyTavern' } as const

/** The keys a field holds, one per comma, trimmed and without blanks or repeats. */
function parseKeys(text: string): string[] {
  const keys: string[] = []
  for (const part of text.split(',')) {
    const key = part.trim()
    if (key !== '' && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/** True where two lists hold the same keys, whatever their case or order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  const lower = (keys: readonly string[]): string => [...keys.map((key) => key.toLowerCase())].sort().join('\n')
  return lower(a) === lower(b)
}

/** What the field says is wrong with a set of keys, or null where they will do. */
function keyProblem(keys: readonly string[]): string | null {
  if (keys.length > MAX_LORE_KEYS) return `Use ${MAX_LORE_KEYS} keys at most.`
  if (keys.some((key) => key.length > MAX_LORE_KEY_LENGTH)) return `A key can be ${MAX_LORE_KEY_LENGTH} characters at most.`
  return null
}

/** The overrides with `ref`'s replaced by `next`, or removed where nothing is left of it. */
function withOverride(
  all: ShippedLoreOverrides | undefined,
  ref: string,
  next: ShippedLoreOverride
): ShippedLoreOverrides {
  const rest = { ...all }
  if (Object.keys(next).length === 0) delete rest[ref]
  else rest[ref] = next
  return rest
}

/** True where the override changes the entry's text or keys. */
function isEdited(override: ShippedLoreOverride | undefined): boolean {
  return Boolean(override && (override.text !== undefined || override.addedKeys || override.keys))
}

/** What an entry modal hands back. */
interface EntryDraft {
  name: string
  keys: string[]
  text: string
  always: boolean
}

/** The entry a modal is open on. */
type EntryTarget =
  | { kind: 'shipped'; entry: LoreEntry; ref: string; override?: ShippedLoreOverride }
  | { kind: 'player'; bookId: string; entry: LoreBookEntry | null }

interface LoreEntryModalProps {
  theme: ScreenTheme
  target: EntryTarget
  /** Keeps the draft. False when the write failed, which leaves the panel open. */
  onSave: (draft: EntryDraft) => Promise<boolean>
  onClose: () => void
}

/** One entry's keys, text and, for the player's own, name and always-on switch. */
function LoreEntryModal({ theme, target, onSave, onClose }: LoreEntryModalProps): JSX.Element | null {
  const shipped = target.kind === 'shipped'
  const hasId = shipped && target.entry.id !== undefined
  const initialKeys = shipped
    ? hasId
      ? (target.override?.addedKeys ?? [])
      : (target.override?.keys ?? target.entry.keys)
    : (target.entry?.keys ?? [])
  const [name, setName] = useState(target.kind === 'player' ? (target.entry?.name ?? '') : '')
  const [keys, setKeys] = useState(initialKeys.join(', '))
  const [text, setText] = useState(
    shipped ? (target.override?.text ?? target.entry.text) : (target.entry?.text ?? '')
  )
  const [always, setAlways] = useState(target.kind === 'player' && target.entry?.always === true)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** Keeps the draft once it holds up; otherwise says what is wrong. */
  async function submit(): Promise<void> {
    if (busy) return
    const parsed = parseKeys(keys)
    const wrong =
      keyProblem(parsed) ??
      (text.length > MAX_LORE_TEXT_LENGTH ? `The text can be ${MAX_LORE_TEXT_LENGTH} characters at most.` : null) ??
      (!shipped && text.trim() === '' ? 'The text can\'t be empty.' : null) ??
      (!shipped && !always && parsed.length === 0 ? 'Give it a key, or make it always on.' : null)
    setProblem(wrong)
    if (wrong) return
    setBusy(true)
    const ok = await onSave({ name: name.trim(), keys: parsed, text, always })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame
      id="lore-entry"
      theme={theme}
      title={shipped ? 'Edit entry' : target.entry ? 'Edit entry' : 'Add entry'}
      confirm={shipped || target.entry ? 'Save' : 'Add'}
      wide
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      {target.kind === 'player' && (
        <TextField
          id="lore-entry-name"
          label="Name"
          hint="Only for finding it in the list."
          value={name}
          onChange={setName}
          placeholder="none"
          maxLength={MAX_LORE_NAME_LENGTH}
          autoFocus={target.entry === null}
        />
      )}
      {shipped && hasId && (
        <p className="vu-studio-note">
          Shipped keys, which stay: {target.entry.keys.join(', ')}. The game also finds this place by them.
        </p>
      )}
      {!(target.kind === 'player' && always) && (
        <TextField
          id="lore-entry-keys"
          label={shipped && hasId ? 'Added keys' : 'Keys'}
          hint={
            shipped && !hasId
              ? 'Words that bring it in, separated by commas. They replace the shipped ones.'
              : 'Words that bring it in when a scene says one, separated by commas.'
          }
          value={keys}
          onChange={setKeys}
          placeholder="none"
          autoFocus={shipped}
        />
      )}
      {target.kind === 'player' && (
        <CheckField
          id="lore-entry-always"
          label="Always on"
          note="Sent with every scene and text thread, whatever is said. It needs no keys."
          checked={always}
          onChange={setAlways}
        />
      )}
      <TextField
        id="lore-entry-text"
        label="Text"
        hint={shipped ? 'Sent as written. Leave it empty for the shipped text.' : 'Sent as written.'}
        value={text}
        onChange={setText}
        multiline
        autoGrow
      />
      {problem && (
        <p className="vu-studio-note" role="alert">
          <span className="vu-studio-tag vu-studio-tag--warn">Not saved</span> {problem}
        </p>
      )}
    </FormFrame>
  )
}

interface LoreNameModalProps {
  theme: ScreenTheme
  title: string
  confirm: string
  name: string
  onSave: (name: string) => Promise<boolean>
  onClose: () => void
}

/** A book's name, asked for when it is made or renamed. */
function LoreNameModal({ theme, title, confirm, name, onSave, onClose }: LoreNameModalProps): JSX.Element | null {
  const [text, setText] = useState(name)
  const [busy, setBusy] = useState(false)

  /** Keeps the name; an empty one leaves the panel open. */
  async function submit(): Promise<void> {
    const trimmed = text.trim()
    if (busy || trimmed === '') return
    setBusy(true)
    const ok = await onSave(trimmed)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame id="lore-name" theme={theme} title={title} confirm={confirm} onClose={onClose} onConfirm={() => void submit()}>
      <TextField
        id="lore-name-text"
        label="Name"
        value={text}
        onChange={setText}
        placeholder="Lorebook"
        maxLength={MAX_LORE_NAME_LENGTH}
        autoFocus
      />
    </FormFrame>
  )
}

/** A heading and the first of a list of report rows, with how many more there are. */
function noteList(notes: readonly WorldInfoNote[], heading: string): JSX.Element | null {
  if (notes.length === 0) return null
  return (
    <>
      <p className="vu-studio-note">{heading}</p>
      <ul className="vu-studio-warnings">
        {notes.slice(0, REPORT_ROWS).map((note, index) => (
          <li key={index}>
            {note.name}: {note.reason}
          </li>
        ))}
        {notes.length > REPORT_ROWS && <li>And {notes.length - REPORT_ROWS} more.</li>}
      </ul>
    </>
  )
}

interface LoreImportModalProps {
  theme: ScreenTheme
  book: LoreBook
  report: WorldInfoReport
  /** Keeps the book and turns it on. False when the write failed, which leaves the panel open. */
  onSave: (book: LoreBook) => Promise<boolean>
  onClose: () => void
}

/** What a World Info import found, and the one chance to name the book before it is kept. */
function LoreImportModal({ theme, book, report, onSave, onClose }: LoreImportModalProps): JSX.Element | null {
  const [name, setName] = useState(book.name)
  const [busy, setBusy] = useState(false)

  /** Keeps the book under the name typed. */
  async function submit(): Promise<void> {
    if (busy) return
    setBusy(true)
    const ok = await onSave({ ...book, name: name.trim() || book.name })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <FormFrame
      id="lore-import"
      theme={theme}
      title="Import World Info"
      confirm="Keep lorebook"
      wide
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <p className="vu-studio-note">
        {report.kept === 1 ? '1 entry' : `${report.kept} entries`} came in, {report.working} ready to use.
        Nothing is kept until you confirm, and you can change any entry afterward.
      </p>
      {noteList(report.off, 'These came in turned off:')}
      {noteList(report.dropped, 'These were left out:')}
      {report.macros.length > 0 && (
        <p className="vu-studio-note">
          The writer is sent text exactly as written, so these are not filled in:{' '}
          {report.macros.map((use) => `${use.macro} (${use.entries})`).join(', ')}.
        </p>
      )}
      {report.notes.length > 0 && (
        <ul className="vu-studio-warnings">
          {report.notes.slice(0, REPORT_ROWS).map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
      <TextField id="lore-import-name" label="Name" value={name} onChange={setName} placeholder={book.name} maxLength={MAX_LORE_NAME_LENGTH} />
    </FormFrame>
  )
}

/** Where the tab is: the list of books, or one book's entries. */
type View = { kind: 'books' } | { kind: 'shipped' } | { kind: 'book'; id: string }

/**
 * The Lorebook tab's page and the panels it opens. The page goes inside the studio's page
 * frame; the panels stand beside the studio's own, never inside it.
 */
export function useLorebookTab(theme: ScreenTheme): { content: JSX.Element; panels: JSX.Element } {
  const status = useLoreStore((s) => s.status)
  const index = useLoreStore((s) => s.index)
  const books = useLoreStore((s) => s.books)
  const summaries = useLoreStore((s) => s.summaries)

  const [view, setView] = useState<View>({ kind: 'books' })
  const [entryEdit, setEntryEdit] = useState<EntryTarget | null>(null)
  const [entryDelete, setEntryDelete] = useState<{ bookId: string; entry: LoreBookEntry } | null>(null)
  const [bookName, setBookName] = useState<{ book: LoreBook | null } | null>(null)
  const [bookDelete, setBookDelete] = useState<LoreBook | null>(null)
  const [importing, setImporting] = useState<{ book: LoreBook; report: WorldInfoReport } | null>(null)
  const picking = useRef(false)
  const backup = useStudioBackup(theme, 'lorebooks')

  const store = useLoreStore

  /** Reads a World Info file the player picks, then opens the import step on it. */
  async function importFile(): Promise<void> {
    if (picking.current) return
    picking.current = true
    try {
      const file = await store.getState().pickFile()
      if (!file) return
      let json: unknown
      try {
        json = JSON.parse(file.text)
      } catch {
        useUiStore.getState().showError({ code: 'LOREBOOK_IMPORT_INVALID', message: 'That file is not a World Info file.' })
        return
      }
      const result = importWorldInfo(json, crypto.randomUUID(), file.fileName)
      if (!result.ok) {
        useUiStore.getState().showError({ code: 'LOREBOOK_IMPORT_INVALID', message: result.error })
        return
      }
      setImporting({ book: result.book, report: result.report })
    } finally {
      picking.current = false
    }
  }

  /** Keeps the open book with one entry changed, added or removed. */
  function saveEntries(book: LoreBook, change: (entries: LoreBookEntry[]) => LoreBookEntry[]): Promise<boolean> {
    return store.getState().saveBook({ ...book, entries: change([...book.entries]) })
  }

  /** Keeps one shipped entry's override as `next` leaves it. */
  function saveOverride(ref: string, next: ShippedLoreOverride): Promise<boolean> {
    return store.getState().saveShipped(withOverride(store.getState().index.shipped, ref, next))
  }

  /** Keeps what an entry panel was asked for. */
  async function saveDraft(target: EntryTarget, draft: EntryDraft): Promise<boolean> {
    if (target.kind === 'shipped') {
      const next: ShippedLoreOverride = {}
      if (draft.text.trim() !== '' && draft.text !== target.entry.text) next.text = draft.text
      if (target.entry.id) {
        const added = draft.keys.filter(
          (key) => !target.entry.keys.some((own) => own.toLowerCase() === key.toLowerCase())
        )
        if (added.length > 0) next.addedKeys = added
      } else if (draft.keys.length > 0 && !sameKeys(draft.keys, target.entry.keys)) {
        next.keys = draft.keys
      }
      if (target.override?.enabled === false) next.enabled = false
      return saveOverride(target.ref, next)
    }
    const book = store.getState().books[target.bookId]
    if (!book) return false
    const entry: LoreBookEntry = {
      uid: target.entry?.uid ?? crypto.randomUUID(),
      keys: draft.always ? [] : draft.keys,
      text: draft.text,
      enabled: target.entry?.enabled ?? true,
      ...(draft.name !== '' ? { name: draft.name } : {}),
      ...(draft.always ? { always: true as const } : {})
    }
    return saveEntries(book, (entries) =>
      target.entry ? entries.map((own) => (own.uid === entry.uid ? entry : own)) : [...entries, entry]
    )
  }

  /** The list of books: the game's own first, then the player's. */
  function booksView(): JSX.Element {
    const edits = Object.keys(index.shipped ?? {}).length
    return (
      <>
        <div className="vu-studio-actions">
          <StudioPill id="lore-add-book" word="Add book" onClick={() => setBookName({ book: null })} />
          <StudioPill id="lore-import" word="Import World Info" onClick={() => void importFile()} />
          {backup.actions}
        </div>
        <ul className="vu-rows">
          <li className="vu-row vu-studio-row">
            <span className="vu-studio-body">
              <span className="vu-studio-name">Game lorebook</span>
              <span className="vu-studio-meta">
                The game&apos;s own places and institutions. {SHIPPED_LORE.shipped.length} entries
                {edits > 0 ? `, ${edits} changed` : ''}.
              </span>
            </span>
            <span className="vu-studio-tools">
              <StudioPill id="lore-open-shipped" word="Open" onClick={() => setView({ kind: 'shipped' })} />
            </span>
          </li>
          {summaries.map((summary) => (
            <li key={summary.id} className="vu-row vu-studio-row">
              <span className="vu-studio-body">
                <CheckField
                  id={`lore-on-${summary.id}`}
                  label={summary.name}
                  note={`${SOURCE_WORDS[summary.source]}. ${summary.entryCount === 1 ? '1 entry' : `${summary.entryCount} entries`}.`}
                  checked={index.on.includes(summary.id)}
                  onChange={(on) => void store.getState().setBookOn(summary.id, on)}
                />
              </span>
              <span className="vu-studio-tools">
                <StudioPill id={`lore-open-${summary.id}`} word="Open" onClick={() => setView({ kind: 'book', id: summary.id })} />
                <StudioPill
                  id={`lore-rename-${summary.id}`}
                  word="Rename"
                  onClick={() => {
                    const book = books[summary.id]
                    if (book) setBookName({ book })
                  }}
                />
                <StudioPill
                  id={`lore-delete-${summary.id}`}
                  word="Delete"
                  onClick={() => {
                    const book = books[summary.id]
                    if (book) setBookDelete(book)
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      </>
    )
  }

  /** The heading over an open book, with the way back. */
  function bookHead(name: string, more?: JSX.Element): JSX.Element {
    return (
      <>
        <p className="vu-studio-current">
          <span className="vu-settings-heading">Lorebook</span>
          <span className="vu-studio-current-name">{name}</span>
        </p>
        <div className="vu-studio-actions">
          <StudioPill id="lore-back" word="All books" onClick={() => setView({ kind: 'books' })} />
          {more}
        </div>
      </>
    )
  }

  /** The game's own entries, as edited. */
  function shippedView(): JSX.Element {
    return (
      <>
        {bookHead('Game lorebook')}
        <ul className="vu-rows">
          {SHIPPED_LORE.shipped.map((item) => {
            const override = index.shipped?.[item.ref]
            const edited = isEdited(override)
            const off = override?.enabled === false
            const keys = item.shipped.id
              ? [...item.shipped.keys, ...(override?.addedKeys ?? [])]
              : (override?.keys ?? item.shipped.keys)
            return (
              <li key={item.ref} className="vu-row vu-studio-row">
                <span className="vu-studio-body">
                  <span className="vu-studio-name">{item.shipped.keys[0]}</span>
                  <span className="vu-studio-meta">{keys.join(', ')}</span>
                  <span className="vu-studio-value">{override?.text ?? item.shipped.text}</span>
                </span>
                {edited && <span className="vu-studio-tag">Edited</span>}
                {off && <span className="vu-studio-tag vu-studio-tag--warn">Off</span>}
                <span className="vu-studio-tools">
                  <StudioPill
                    id={`lore-edit-${item.ref}`}
                    word="Edit"
                    onClick={() => setEntryEdit({ kind: 'shipped', entry: item.shipped, ref: item.ref, ...(override ? { override } : {}) })}
                  />
                  <StudioPill
                    id={`lore-toggle-${item.ref}`}
                    word={off ? 'Turn on' : 'Turn off'}
                    onClick={() => {
                      const { enabled: _enabled, ...rest } = override ?? {}
                      void saveOverride(item.ref, off ? rest : { ...rest, enabled: false })
                    }}
                  />
                  {override && (
                    <StudioPill id={`lore-reset-${item.ref}`} word="Reset" onClick={() => void saveOverride(item.ref, {})} />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </>
    )
  }

  /** One of the player's books and its entries. */
  function bookView(book: LoreBook): JSX.Element {
    return (
      <>
        {bookHead(
          book.name,
          <StudioPill id="lore-add-entry" word="Add entry" onClick={() => setEntryEdit({ kind: 'player', bookId: book.id, entry: null })} />
        )}
        {book.entries.length === 0 ? (
          <p className="vu-empty vu-empty--flush">No entries yet.</p>
        ) : (
          <ul className="vu-rows">
            {book.entries.map((entry) => (
              <li key={entry.uid} className="vu-row vu-studio-row">
                <span className="vu-studio-body">
                  <span className="vu-studio-name">{entry.name ?? entry.keys[0] ?? 'Always on'}</span>
                  <span className="vu-studio-meta">{entry.always ? 'Always on' : entry.keys.join(', ')}</span>
                  <span className="vu-studio-value">{entry.text}</span>
                  {entry.conflict && (
                    <span className="vu-studio-note">
                      <span className="vu-studio-tag vu-studio-tag--warn">Conflict</span> {entry.conflict}
                    </span>
                  )}
                </span>
                {!entry.enabled && <span className="vu-studio-tag vu-studio-tag--warn">Off</span>}
                <span className="vu-studio-tools">
                  <StudioPill
                    id={`lore-edit-${entry.uid}`}
                    word="Edit"
                    onClick={() => setEntryEdit({ kind: 'player', bookId: book.id, entry })}
                  />
                  <StudioPill
                    id={`lore-toggle-${entry.uid}`}
                    word={entry.enabled ? 'Turn off' : 'Turn on'}
                    onClick={() =>
                      void saveEntries(book, (entries) =>
                        entries.map((own) => {
                          if (own.uid !== entry.uid) return own
                          // Turning it on is the player's answer to whatever the import said.
                          const { conflict: _conflict, ...rest } = own
                          return { ...rest, enabled: !own.enabled }
                        })
                      )
                    }
                  />
                  <StudioPill id={`lore-remove-${entry.uid}`} word="Delete" onClick={() => setEntryDelete({ bookId: book.id, entry })} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  const open = view.kind === 'book' ? books[view.id] : undefined
  let content: JSX.Element
  if (status === 'idle') content = <p className="vu-empty vu-empty--flush">Loading lorebooks.</p>
  else if (status === 'failed') {
    content = (
      <p className="vu-empty vu-empty--flush">
        The lorebooks could not be read. Their file may be damaged, or written by another version of the game.
      </p>
    )
  } else if (view.kind === 'shipped') content = shippedView()
  else if (open) content = bookView(open)
  else content = booksView()

  const entryBook = entryDelete ? books[entryDelete.bookId] : undefined

  const panels = (
    <>
      {backup.panel}
      <AnimatePresence propagate>
        {entryEdit && (
          <LoreEntryModal
            key="lore-entry"
            theme={theme}
            target={entryEdit}
            onSave={(draft) => saveDraft(entryEdit, draft)}
            onClose={() => setEntryEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {entryDelete && entryBook && (
          <ConfirmModal
            key="lore-entry-delete"
            id="lore-entry-delete"
            theme={theme}
            title="Delete entry?"
            message="The entry and its text are removed from this book."
            confirmText="Delete entry"
            cancelText="Keep it"
            onConfirm={() => {
              const { entry } = entryDelete
              setEntryDelete(null)
              void saveEntries(entryBook, (entries) => entries.filter((own) => own.uid !== entry.uid))
            }}
            onCancel={() => setEntryDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {bookName && (
          <LoreNameModal
            key="lore-name"
            theme={theme}
            title={bookName.book ? 'Rename lorebook' : 'Add lorebook'}
            confirm={bookName.book ? 'Rename' : 'Add'}
            name={bookName.book?.name ?? ''}
            onSave={async (name) => {
              const book = bookName.book
              if (book) return store.getState().saveBook({ ...book, name })
              const fresh: LoreBook = { schemaVersion: 1, id: crypto.randomUUID(), name, source: 'native', entries: [] }
              const ok = await store.getState().addBook(fresh)
              if (ok) setView({ kind: 'book', id: fresh.id })
              return ok
            }}
            onClose={() => setBookName(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {bookDelete && (
          <ConfirmModal
            key="lore-book-delete"
            id="lore-book-delete"
            theme={theme}
            title="Delete lorebook?"
            message={`"${bookDelete.name}" and its ${bookDelete.entries.length === 1 ? 'entry' : `${bookDelete.entries.length} entries`} are removed. Your saves are not touched.`}
            confirmText="Delete lorebook"
            cancelText="Keep it"
            onConfirm={() => {
              const gone = bookDelete.id
              setBookDelete(null)
              if (view.kind === 'book' && view.id === gone) setView({ kind: 'books' })
              void store.getState().removeBook(gone)
            }}
            onCancel={() => setBookDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {importing && (
          <LoreImportModal
            key="lore-import"
            theme={theme}
            book={importing.book}
            report={importing.report}
            onSave={async (book) => {
              const ok = await store.getState().addBook(book)
              if (ok) setView({ kind: 'book', id: book.id })
              return ok
            }}
            onClose={() => setImporting(null)}
          />
        )}
      </AnimatePresence>
    </>
  )

  return { content, panels }
}
