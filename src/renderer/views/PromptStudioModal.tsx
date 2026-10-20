/**
 * Prompt Studio: the presets that arrange a scene's request, the fixed text of the game's
 * prompts, the save's preset variables and a preview of the next scene's request. Every change
 * is written as it is confirmed, so the panel holds nothing unsaved of its own.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { hasDynamicMacros } from '@shared/presets/macros'
import { planPresetRequest } from '@shared/presets/request'
import {
  PROTECTED_MARKERS,
  type GameMarker,
  type GlobalTextId,
  type Preset,
  type PresetBlock,
  type PresetRequest,
  type PresetSource,
  type PresetSummary,
  type SceneTextId
} from '@shared/presets/types'
import { CheckField } from '../components/CheckField'
import { ConfirmModal } from '../components/ConfirmModal'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import { defaultBlockText, PROMPT_BLOCKS, type PromptBlock } from '../prompts/promptBlocks'
import { useGameStore } from '../stores/gameStore'
import { usePromptStudioStore } from '../stores/promptStudioStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { ScreenTheme } from './clockTheme'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  toggleLift,
  veilIn
} from './motion'
import { ChevronIcon, PlusIcon } from './screenIcons'
import {
  PresetBlockModal,
  PresetImportModal,
  PresetNameModal,
  VariableModal
} from './PromptStudioModals'
import { SystemPromptModal } from './SystemPromptModal'
import '../vu_styles/Settings.css'
import '../vu_styles/PromptStudio.css'

type TabId = 'presets' | 'blocks' | 'scene' | 'other' | 'variables' | 'preview'

/** Each tab's word and the one line over its page. */
const TABS: readonly { id: TabId; word: string; intro: string }[] = [
  {
    id: 'presets',
    word: 'Presets',
    intro:
      'A preset arranges what the writer is sent for a scene. Import one from SillyTavern or Marinara, or stay on the built-in Default. Only scenes use it: texting and everything else keep the game\'s own order.'
  },
  {
    id: 'blocks',
    word: 'Blocks',
    intro:
      "The order the writer reads a scene's request in. Game rows are the game's own sections: move them or turn them off, but they stay."
  },
  {
    id: 'scene',
    word: 'Scene text',
    intro: "The writer's instructions for scenes. They belong to this preset, so another preset brings its own."
  },
  {
    id: 'other',
    word: 'Other prompts',
    intro: "The writer's instructions for everything outside a scene. Every preset shares them."
  },
  {
    id: 'variables',
    word: 'Variables',
    intro:
      'What a preset remembers from turn to turn, kept with this game. The writer may update them with each reply.'
  },
  {
    id: 'preview',
    word: 'Preview',
    intro: 'The last scene request, as this preset would send it now. Rolls and random picks change on every call.'
  }
]

/** What each source is called beside a preset's name. */
const SOURCE_WORDS: Record<PresetSource, string> = {
  sillytavern: 'SillyTavern',
  marinara: 'Marinara',
  native: 'Built in'
}

/** What each of the game's own sections is called on its row. */
const GAME_ROW_WORDS: Record<GameMarker, string> = {
  persona: 'Game: writer persona',
  jsonRules: 'Game: reply rules',
  setting: 'Game: setting',
  reader: 'Game: the reader',
  cast: 'Game: cast',
  now: 'Game: date and time',
  class: 'Game: class',
  lorebook: 'Game: lorebook',
  modLines: 'Game: mod notes',
  storyRecall: 'Game: story recall',
  storySoFar: 'Game: story so far',
  sceneSoFar: 'Game: scene so far',
  yourTurn: "Game: this turn's instructions"
}

/** A fresh block, ready for its name and text. */
function newBlock(): PresetBlock {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: 'system',
    enabled: true,
    position: 'ordered',
    depth: 0,
    content: ''
  }
}

/** The preset's main block, where it names one that is still there. */
function mainBlockOf(preset: Preset): PresetBlock | undefined {
  return preset.mainBlockId ? preset.blocks.find((block) => block.id === preset.mainBlockId) : undefined
}

/** A preset with one text block's edit set, or cleared where `value` is undefined; an empty map is dropped. */
function withSceneText(preset: Preset, id: SceneTextId, value: string | undefined): Preset {
  const { overrides, ...rest } = preset
  const next = { ...overrides }
  if (value === undefined) delete next[id]
  else next[id] = value
  return Object.keys(next).length > 0 ? { ...rest, overrides: next } : rest
}

/** The settings' global text edits with one set or cleared; an empty map is `undefined`. */
function withGlobalText(
  edits: Partial<Record<GlobalTextId, string>> | undefined,
  id: GlobalTextId,
  value: string | undefined
): Partial<Record<GlobalTextId, string>> | undefined {
  const next = { ...edits }
  if (value === undefined) delete next[id]
  else next[id] = value
  return Object.keys(next).length > 0 ? next : undefined
}

export interface PromptStudioModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

export function PromptStudioModal({ theme, onClose }: PromptStudioModalProps): JSX.Element | null {
  const presets = usePromptStudioStore((s) => s.presets)
  const activeId = usePromptStudioStore((s) => s.activeId)
  const active = usePromptStudioStore((s) => s.active)
  const lastSceneRequest = usePromptStudioStore((s) => s.lastSceneRequest)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const playthroughId = useGameStore((s) => s.playthroughId)
  const presetVars = useGameStore((s) => s.presetVars)
  const playerFirstName = useGameStore((s) => s.playerFirstName)
  // A decision point: the reader's turn, with no call in flight.
  const atDecision = useGameStore((s) => s.awaitingInput && !s.busy && !s.streaming)

  const [tab, setTab] = useState<TabId>('presets')
  const [textEdit, setTextEdit] = useState<PromptBlock | null>(null)
  const [blockEdit, setBlockEdit] = useState<{ block: PresetBlock; isNew: boolean } | null>(null)
  const [blockDelete, setBlockDelete] = useState<PresetBlock | null>(null)
  const [renaming, setRenaming] = useState<PresetSummary | null>(null)
  const [presetDelete, setPresetDelete] = useState<PresetSummary | null>(null)
  const [importing, setImporting] = useState<{ preset: Preset; warnings: string[] } | null>(null)
  const [varEdit, setVarEdit] = useState<string | null>(null)
  const [varsReset, setVarsReset] = useState(false)
  // Holds off a second write while the first is in flight, so each reads the preset the last left.
  const writing = useRef(false)
  const picking = useRef(false)

  useEffect(() => {
    void usePromptStudioStore.getState().load()
  }, [])

  const { host, overlayProps } = useModalShell(onClose)

  const hasGame = playthroughId !== null
  const tabs = TABS.filter((entry) => entry.id !== 'variables' || hasGame)
  const shown = tabs.find((entry) => entry.id === tab) ?? tabs[0]

  const lessNsfwText = settings?.lessNsfwText ?? false
  const scenePersona = settings?.scenePersona

  /** Writes the active preset as `change` leaves it. */
  async function commit(change: (preset: Preset) => Preset): Promise<void> {
    const current = usePromptStudioStore.getState().active
    if (!current || writing.current) return
    writing.current = true
    try {
      await usePromptStudioStore.getState().save(change(current))
    } finally {
      writing.current = false
    }
  }

  /** Reads a file the player picks, then opens the import step on it. */
  async function importFile(): Promise<void> {
    if (picking.current) return
    picking.current = true
    try {
      const result = await usePromptStudioStore.getState().importFile()
      if (result) setImporting(result)
    } finally {
      picking.current = false
    }
  }

  /** Moves one row a step; the first and last rows have nowhere further to go. */
  function move(index: number, by: -1 | 1): void {
    void commit((preset) => {
      const blocks = [...preset.blocks]
      const to = index + by
      if (to < 0 || to >= blocks.length) return preset
      ;[blocks[index], blocks[to]] = [blocks[to], blocks[index]]
      return { ...preset, blocks }
    })
  }

  /** Writes one text block's edit to where its owner keeps it. */
  async function saveText(block: PromptBlock, value: string | undefined): Promise<boolean> {
    if (block.owner === 'preset') {
      const current = usePromptStudioStore.getState().active
      if (!current) return false
      return usePromptStudioStore.getState().save(withSceneText(current, block.id as SceneTextId, value))
    }
    return update({ promptBlocks: withGlobalText(settings?.promptBlocks, block.id as GlobalTextId, value) })
  }

  /** The stored edit of a text block, where there is one. */
  function editOf(block: PromptBlock): string | undefined {
    return block.owner === 'preset'
      ? active?.overrides?.[block.id as SceneTextId]
      : settings?.promptBlocks?.[block.id as GlobalTextId]
  }

  /** The two texts the next scene would send, or null where no scene has been asked for yet. */
  const preview = useMemo(() => {
    if (!lastSceneRequest) return null
    const tag = lastSceneRequest.sceneSpot
    const request: PresetRequest | undefined = tag
      ? {
          spot: tag.spot,
          playthroughId: playthroughId ?? 'unsaved',
          vars: { ...presetVars },
          names: { user: playerFirstName, char: tag.cast[0] ?? '', group: tag.cast.join(', ') }
        }
      : undefined
    const plan = planPresetRequest(
      request ? { ...lastSceneRequest, preset: request } : lastSceneRequest,
      active ?? null,
      () => 0.5
    )
    return { system: plan.request.system, user: plan.request.user }
  }, [lastSceneRequest, active, playthroughId, presetVars, playerFirstName])

  if (!host) return null

  /** One quiet pill at the end of a row. */
  function pill(id: string, word: string, onClick: () => void): JSX.Element {
    return (
      <motion.button
        id={id}
        className="vu-pill"
        type="button"
        {...gestures(false, quietLift, quietPress)}
        onClick={onClick}
      >
        {word}
      </motion.button>
    )
  }

  /** A page's lead line, over whatever scrolls. */
  function page(children: ReactNode): JSX.Element {
    return (
      <div className="vu-studio-page" id={`studio-page-${shown.id}`} role="tabpanel">
        <p className="vu-studio-intro">{shown.intro}</p>
        <div className="vu-scroll-box">
          <div className="vu-studio-scroll">{children}</div>
          <div className="vu-scroll-fade" />
        </div>
      </div>
    )
  }

  /** The Presets page. */
  function presetsPage(): JSX.Element {
    return page(
      <>
        <div className="vu-studio-actions">
          <motion.button
            id="studio-import"
            className="vu-pill"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => void importFile()}
          >
            <PlusIcon size={16} />
            Import preset
          </motion.button>
        </div>
        {presets.length === 0 ? (
          <p className="vu-empty vu-empty--flush">Loading presets.</p>
        ) : (
          <ul className="vu-rows">
            {presets.map((entry) => {
              const on = entry.id === activeId
              return (
                <li key={entry.id} className="vu-row vu-studio-row">
                  <span className="vu-studio-body">
                    <span className="vu-studio-name">{entry.name}</span>
                    <span className="vu-studio-meta">{SOURCE_WORDS[entry.source]}</span>
                  </span>
                  {on && <span className="vu-studio-tag">Active</span>}
                  <span className="vu-studio-tools">
                    {!on &&
                      pill(`studio-activate-${entry.id}`, 'Make active', () =>
                        void usePromptStudioStore.getState().setActive(entry.id)
                      )}
                    {pill(`studio-rename-${entry.id}`, 'Rename', () => setRenaming(entry))}
                    {pill(`studio-duplicate-${entry.id}`, 'Duplicate', () =>
                      void usePromptStudioStore.getState().duplicate(entry.id)
                    )}
                    {presets.length > 1 &&
                      pill(`studio-delete-${entry.id}`, 'Delete', () => setPresetDelete(entry))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  /** One row of the Blocks page. */
  function blockRow(preset: Preset, block: PresetBlock, index: number): JSX.Element {
    const marker = block.marker
    const replaced = marker === 'persona' && preset.mainReplacesPersona === true && mainBlockOf(preset) !== undefined
    const fixed = marker !== undefined && PROTECTED_MARKERS.includes(marker)
    const label = marker ? GAME_ROW_WORDS[marker] : block.name
    const uncached = !marker && block.role === 'system' && block.enabled && hasDynamicMacros(block.content)

    return (
      <li key={block.id} className={`vu-row vu-studio-row${replaced ? ' vu-studio-row--replaced' : ''}`}>
        <span className="vu-studio-moves">
          {index > 0 ? (
            <motion.button
              className="vu-square vu-square--step vu-studio-up"
              type="button"
              aria-label={`Move ${label} up`}
              {...gestures(false, quietLift, quietPress)}
              onClick={() => move(index, -1)}
            >
              <ChevronIcon down />
            </motion.button>
          ) : (
            <span className="vu-studio-gap" />
          )}
          {index < preset.blocks.length - 1 && (
            <motion.button
              className="vu-square vu-square--step"
              type="button"
              aria-label={`Move ${label} down`}
              {...gestures(false, quietLift, quietPress)}
              onClick={() => move(index, 1)}
            >
              <ChevronIcon down />
            </motion.button>
          )}
        </span>
        <span className="vu-studio-body">
          {fixed ? (
            <span className="vu-studio-name">{label}</span>
          ) : (
            <CheckField
              id={`studio-block-${block.id}`}
              label={label}
              checked={block.enabled}
              onChange={(enabled) =>
                void commit((current) => ({
                  ...current,
                  blocks: current.blocks.map((b) => (b.id === block.id ? { ...b, enabled } : b))
                }))
              }
            />
          )}
          {replaced && <span className="vu-studio-note">The main block is sent in its place.</span>}
          {block.conflict && (
            <span className="vu-studio-note">
              <span className="vu-studio-tag vu-studio-tag--warn">Conflict</span> {block.conflict}
            </span>
          )}
          {uncached && (
            <span className="vu-studio-note">
              <span className="vu-studio-tag vu-studio-tag--warn">Not cached</span> This text changes on every call,
              so the system prompt can't be cached. Moving it to the user role avoids that.
            </span>
          )}
        </span>
        {replaced && <span className="vu-studio-tag">Replaced</span>}
        <span className="vu-studio-tools">
          {(marker === 'persona' || marker === 'yourTurn') &&
            pill(`studio-text-${marker}`, 'Scene text', () => setTab('scene'))}
          {!marker && pill(`studio-edit-${block.id}`, 'Edit', () => setBlockEdit({ block, isNew: false }))}
          {!marker && pill(`studio-remove-${block.id}`, 'Delete', () => setBlockDelete(block))}
        </span>
      </li>
    )
  }

  /** The Blocks page. */
  function blocksPage(): JSX.Element {
    if (!active) return page(<p className="vu-empty vu-empty--flush">Loading presets.</p>)
    const main = mainBlockOf(active)
    return page(
      <>
        <div className="vu-studio-actions">
          <motion.button
            id="studio-add-block"
            className="vu-pill"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => setBlockEdit({ block: newBlock(), isNew: true })}
          >
            <PlusIcon size={16} />
            Add block
          </motion.button>
        </div>
        {main && (
          <CheckField
            id="studio-main-replaces"
            label="Main block replaces the game persona"
            note={`Sends "${main.name}" in place of the game's own writer persona. Off sends both.`}
            checked={active.mainReplacesPersona === true}
            onChange={(on) => void commit((current) => ({ ...current, mainReplacesPersona: on }))}
          />
        )}
        <ul className="vu-rows">{active.blocks.map((block, index) => blockRow(active, block, index))}</ul>
      </>
    )
  }

  /** The Scene text and Other prompts pages: one row per editable block. */
  function textPage(owner: PromptBlock['owner']): JSX.Element {
    return page(
      <ul className="vu-rows">
        {PROMPT_BLOCKS.filter((block) => block.owner === owner).map((block) => (
          <li key={block.id} className="vu-row vu-studio-row">
            <span className="vu-studio-body">
              <span className="vu-studio-name">{block.label}</span>
              <span className="vu-studio-meta">{block.hint}</span>
            </span>
            {editOf(block) !== undefined && <span className="vu-studio-tag">Edited</span>}
            <span className="vu-studio-tools">
              {pill(`studio-edit-text-${block.id}`, 'Edit', () => setTextEdit(block))}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  /** The Variables page. */
  function variablesPage(): JSX.Element {
    const names = Object.keys(presetVars)
    return page(
      <>
        {atDecision && names.length > 0 && (
          <div className="vu-studio-actions">
            {pill('studio-vars-reset', 'Reset all', () => setVarsReset(true))}
          </div>
        )}
        {names.length === 0 ? (
          <p className="vu-empty vu-empty--flush">Nothing here yet. Variables show up once a preset sets them.</p>
        ) : (
          <ul className="vu-rows">
            {names.map((name) => (
              <li key={name} className="vu-row vu-studio-row">
                <span className="vu-studio-body">
                  <span className="vu-studio-name vu-studio-name--mono">{name}</span>
                  <span className="vu-studio-value">{presetVars[name]}</span>
                </span>
                {atDecision && (
                  <span className="vu-studio-tools">
                    {pill(`studio-var-edit-${name}`, 'Edit', () => setVarEdit(name))}
                    {pill(`studio-var-delete-${name}`, 'Delete', () => {
                      const { [name]: _gone, ...rest } = useGameStore.getState().presetVars
                      useGameStore.getState().setPresetVars(rest)
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  /** The Preview page. */
  function previewPage(): JSX.Element {
    return page(
      preview ? (
        <>
          <label className="vu-field">
            <span className="vu-field-label">System</span>
            <textarea className="vu-input vu-input--multiline vu-studio-preview" readOnly value={preview.system} />
          </label>
          <label className="vu-field">
            <span className="vu-field-label">User</span>
            <textarea className="vu-input vu-input--multiline vu-studio-preview" readOnly value={preview.user} />
          </label>
        </>
      ) : (
        <p className="vu-empty vu-empty--flush">No scene yet. Play one and its request shows up here.</p>
      )
    )
  }

  const textDefault = textEdit ? defaultBlockText(textEdit.id, { lessNsfwText, scenePersona }) : ''
  const varName = varEdit !== null && varEdit in presetVars ? varEdit : null

  return createPortal(
    <>
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
          id="prompt-studio-modal"
          className="vu-settings vu-settings--split vu-studio vu-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Prompt Studio"
          variants={panelUnderTab}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation()
          }}
        >
          <TitleTab>Prompt Studio</TitleTab>

          {/* The tabs stand in the panel's round end, as Settings' do. */}
          <div className="vu-palette vu-settings-tabs vu-studio-tabs" role="tablist" aria-label="Prompt Studio">
            {tabs.map((entry) => {
              const on = shown.id === entry.id
              return (
                <motion.button
                  key={entry.id}
                  id={`studio-tab-${entry.id}`}
                  className={`vu-palette-btn${on ? ' vu-palette-btn--on' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={`studio-page-${entry.id}`}
                  {...gestures(false, toggleLift, quietPress)}
                  onClick={() => setTab(entry.id)}
                >
                  {entry.word}
                </motion.button>
              )
            })}
          </div>

          <div className="vu-settings-pages">
            {shown.id === 'presets' && presetsPage()}
            {shown.id === 'blocks' && blocksPage()}
            {shown.id === 'scene' && textPage('preset')}
            {shown.id === 'other' && textPage('global')}
            {shown.id === 'variables' && variablesPage()}
            {shown.id === 'preview' && previewPage()}
          </div>

          <div className="vu-foot">
            <motion.button
              id="studio-done"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              type="button"
              {...gestures(false, lift, press)}
              onClick={onClose}
            >
              Done
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Siblings of the veil and of each other, never its children: each leaves when this panel does. */}
      <AnimatePresence propagate>
        {textEdit && (
          <SystemPromptModal
            key="studio-text"
            theme={theme}
            title={textEdit.label}
            fieldLabel={textEdit.label}
            discardMessage="This text has not been saved."
            defaultText={textDefault}
            stored={editOf(textEdit) ?? textDefault}
            onSave={(value) => saveText(textEdit, value)}
            onClose={() => setTextEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {blockEdit && (
          <PresetBlockModal
            key="studio-block"
            theme={theme}
            block={blockEdit.block}
            isNew={blockEdit.isNew}
            onSave={(saved) =>
              void commit((current) => {
                if (!blockEdit.isNew) {
                  return { ...current, blocks: current.blocks.map((b) => (b.id === saved.id ? saved : b)) }
                }
                // A new block stands ahead of the game's own instructions.
                const at = current.blocks.findIndex((b) => b.marker === 'yourTurn')
                const blocks = [...current.blocks]
                blocks.splice(at < 0 ? blocks.length : at, 0, saved)
                return { ...current, blocks }
              })
            }
            onClose={() => setBlockEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {blockDelete && (
          <ConfirmModal
            key="studio-block-delete"
            id="studio-block-delete"
            theme={theme}
            title="Delete block?"
            message={`"${blockDelete.name}" and its text are removed from this preset.`}
            confirmText="Delete block"
            cancelText="Keep it"
            onConfirm={() => {
              const gone = blockDelete.id
              setBlockDelete(null)
              void commit((current) => ({
                ...current,
                blocks: current.blocks.filter((b) => b.id !== gone),
                ...(current.mainBlockId === gone
                  ? { mainBlockId: undefined, mainReplacesPersona: undefined }
                  : {})
              }))
            }}
            onCancel={() => setBlockDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {renaming && (
          <PresetNameModal
            key="studio-rename"
            theme={theme}
            name={renaming.name}
            onSave={(name) => void usePromptStudioStore.getState().rename(renaming.id, name)}
            onClose={() => setRenaming(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {presetDelete && (
          <ConfirmModal
            key="studio-preset-delete"
            id="studio-preset-delete"
            theme={theme}
            title="Delete preset?"
            message={`"${presetDelete.name}" is removed. Your saves are not touched.`}
            confirmText="Delete preset"
            cancelText="Keep it"
            onConfirm={() => {
              const gone = presetDelete.id
              setPresetDelete(null)
              void usePromptStudioStore.getState().remove(gone)
            }}
            onCancel={() => setPresetDelete(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {importing && (
          <PresetImportModal
            key="studio-import"
            theme={theme}
            preset={importing.preset}
            warnings={importing.warnings}
            onSave={(preset) => usePromptStudioStore.getState().save(preset)}
            onClose={() => setImporting(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {varName !== null && (
          <VariableModal
            key="studio-variable"
            theme={theme}
            name={varName}
            value={presetVars[varName] ?? ''}
            onSave={(value) =>
              useGameStore.getState().setPresetVars({ ...useGameStore.getState().presetVars, [varName]: value })
            }
            onClose={() => setVarEdit(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence propagate>
        {varsReset && (
          <ConfirmModal
            key="studio-vars-reset"
            id="studio-vars-reset"
            theme={theme}
            title="Reset variables?"
            message="Every variable is cleared, and the preset's own defaults take over. The change is kept with the next save."
            confirmText="Reset variables"
            cancelText="Keep them"
            onConfirm={() => {
              setVarsReset(false)
              useGameStore.getState().setPresetVars({})
            }}
            onCancel={() => setVarsReset(false)}
          />
        )}
      </AnimatePresence>
    </>,
    host
  )
}
