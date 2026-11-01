import { useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { settingKeepable } from '@shared/lorebookRecord'
import { ConfirmModal } from '../components/ConfirmModal'
import { TextField } from '../components/TextField'
import { SETTING } from '../prompts/setting'
import { useLorebookStore } from '../stores/lorebookStore'
import { LorebookPage } from './LorebookPage'
import { fadeIn, gestures, quietLift, quietPress, toggleLift } from './motion'
import { GlobeIcon, LorebookIcon } from './screenIcons'
import '../vu_styles/NewGameSetting.css'

/** The Setting screen's tabs, in the order they stand, each its mark over its word. */
type SettingTab = 'setting' | 'lorebook'
const TABS: readonly { id: SettingTab; word: string; Mark: () => JSX.Element }[] = [
  { id: 'setting', word: 'Setting', Mark: GlobeIcon },
  { id: 'lorebook', word: 'Lorebook', Mark: LorebookIcon }
]

/** The body arriving under the header, built once. */
const BODY_IN = fadeIn(0.2)

/** What the setting box says the setting cannot change. */
const SETTING_HINT =
  "Please note that a total overhaul of the setting isn't possible at this time due to hardcoded elements."

/**
 * The playthrough's setting, kept as it is typed, a blank one held in its box and named on the
 * status line, the build's put back by Reset to default. Mounted only once the lorebook is read,
 * so it opens on the playthrough's.
 */
function SettingEditor({
  revision,
  refused,
  theme
}: {
  revision: number
  refused: boolean
  theme: 'day' | 'night'
}): JSX.Element {
  const edited = useLorebookStore((s) => s.record.setting !== undefined)
  const [text, setText] = useState(() => useLorebookStore.getState().setting)
  const [resetting, setResetting] = useState(false)

  /** Keeps `value` where it can be kept. */
  const save = (value: string): void => {
    if (refused || !settingKeepable(value)) return
    useLorebookStore.getState().editSetting(value.replace(/\s+$/, ''), revision)
  }

  const problem = refused || settingKeepable(text) ? null : 'Write a setting'

  return (
    <div className="vu-ngset-setting">
      <TextField
        id="new-game-setting"
        label="Setting"
        hint={SETTING_HINT}
        value={text}
        multiline
        disabled={refused}
        onChange={(next) => {
          setText(next)
          save(next)
        }}
      />

      <div className="vu-foot-stack">
        <span id="new-game-setting-status" className="vu-form-status">
          {refused ? (
            <>
              <span className="vu-form-dot vu-form-dot--warn" />
              Playthrough lorebook could not be read.
            </>
          ) : problem !== null ? (
            <>
              <span className="vu-form-dot vu-form-dot--warn" />
              {problem}
            </>
          ) : null}
        </span>
        <div className="vu-foot">
          {edited && !refused && (
            <motion.button
              id="new-game-setting-reset"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => setResetting(true)}
            >
              Reset to default
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {resetting && (
          <ConfirmModal
            key="setting-reset"
            id="new-game-setting-reset-confirm"
            theme={theme}
            title="Reset to default?"
            message="Your edits to the setting will be permanently deleted."
            confirmText="Reset"
            onCancel={() => setResetting(false)}
            onConfirm={() => {
              setResetting(false)
              setText(SETTING)
              useLorebookStore.getState().editSetting(SETTING, revision)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** The Setting tab: its editor once the lorebook it is read from is in, afresh after an import. */
function SettingPage({ theme }: { theme: 'day' | 'night' }): JSX.Element | null {
  const status = useLorebookStore((s) => s.status)
  const revision = useLorebookStore((s) => s.revision)
  if (status !== 'ready' && status !== 'refused') return null
  return (
    <SettingEditor
      key={revision}
      revision={revision}
      refused={status === 'refused'}
      theme={theme}
    />
  )
}

/**
 * New Game's Setting screen: a rail of tabs beside one panel — the setting the game's prompts
 * carry, and the playthrough's lorebook laid out as the Bunnyboard's tab lays it out.
 */
export function NewGameSetting({ theme }: { theme: 'day' | 'night' }): JSX.Element {
  const [tab, setTab] = useState<SettingTab>('setting')

  return (
    <motion.div className="vu-newgame-tabbed" variants={BODY_IN} initial="hidden" animate="shown">
      <div className="vu-palette vu-palette--column vu-newgame-tabs" role="tablist" aria-label="Setting">
        {TABS.map((entry) => {
          const on = tab === entry.id
          return (
            <motion.button
              key={entry.id}
              id={`new-game-tab-${entry.id}`}
              className={`vu-palette-btn${on ? ' vu-palette-btn--on' : ''}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="new-game-tab-page"
              {...gestures(false, toggleLift, quietPress)}
              onClick={() => setTab(entry.id)}
            >
              <entry.Mark />
              {entry.word}
            </motion.button>
          )
        })}
      </div>

      {/* The paper face; the page inside it does the clipping, a paper element clipping its own
          shadow. */}
      <div className="vu-newgame-panel vu-paper">
        <div
          id="new-game-tab-page"
          className={`vu-newgame-page${tab === 'lorebook' ? ' vu-bb-body' : ''}`}
          role="tabpanel"
          aria-labelledby={`new-game-tab-${tab}`}
        >
          {tab === 'setting' ? (
            <SettingPage theme={theme} />
          ) : (
            <LorebookPage theme={theme} settingPill={false} />
          )}
        </div>
      </div>
    </motion.div>
  )
}
