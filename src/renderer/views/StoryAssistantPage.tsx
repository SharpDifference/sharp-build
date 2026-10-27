import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { ASSISTANT_PROMPT_LIMIT } from '@shared/storyAssistant'
import { TextField } from '../components/TextField'
import type { ModDetailProps } from '../mods/hooks'
import { DEFAULT_ASSISTANT_PROMPT } from '../prompts/storyAssistantPrompt'
import {
  loadAssistantConfig,
  saveAssistantPrompt,
  useAssistantStore
} from '../stores/storyAssistant'
import { gestures, quietLift, quietPress } from './motion'
import '../vu_styles/StoryAssistant.css'

/**
 * Story Assistant's page on the Mods screen: its options as the screen draws any mod's, then the
 * prompt every read is written from, kept as the box is left. A value it cannot keep stays in the
 * box with the reason under it; Reset to default puts the shipped prompt back.
 */
export function StoryAssistantPage({ mod, Switch, optionOn, setOption }: ModDetailProps): JSX.Element {
  const stored = useAssistantStore((s) => s.config.prompt)
  const [text, setText] = useState(stored ?? DEFAULT_ASSISTANT_PROMPT)
  const [problem, setProblem] = useState<string | null>(null)
  const edited = stored !== undefined
  // Opened before the config was read, the box takes the stored prompt once it is, unless the
  // player has started typing.
  const typed = useRef(false)
  useEffect(() => {
    void loadAssistantConfig().then(() => {
      if (!typed.current) setText(useAssistantStore.getState().config.prompt ?? DEFAULT_ASSISTANT_PROMPT)
    })
  }, [])

  async function keep(value: string): Promise<void> {
    if (value.trim() === (stored ?? DEFAULT_ASSISTANT_PROMPT)) return
    setProblem(await saveAssistantPrompt(value))
  }

  async function reset(): Promise<void> {
    setText(DEFAULT_ASSISTANT_PROMPT)
    setProblem(await saveAssistantPrompt(''))
  }

  const options = mod.options ?? []
  const group = mod.optionGroups?.[0]
  const single = options.filter((option) => !option.group)
  const grouped = options.filter((option) => option.group === group?.id)

  return (
    <>
      <h4 className="vu-mods-label">Options</h4>
      <ul className="vu-mods-options">
        {single.map((option) => (
          <li key={option.id} className="vu-mods-option">
            <span className="vu-mods-option-text">
              <span className="vu-mods-option-label">{option.label}</span>
              <span className="vu-mods-option-hint">{option.hint}</span>
            </span>
            <Switch
              id={`mods-option-${mod.id}-${option.id}`}
              label={option.label}
              on={optionOn(option.id)}
              onChange={(on) => setOption(option.id, on)}
            />
          </li>
        ))}
        {group && (
          <li className="vu-mods-option vu-mods-group">
            <span className="vu-mods-option-text">
              <span className="vu-mods-option-label">{group.label}</span>
              <span className="vu-mods-option-hint">{group.hint}</span>
            </span>
            <ul className="vu-mods-group-list">
              {grouped.map((option) => (
                <li key={option.id} className="vu-mods-group-row">
                  <span className="vu-mods-group-label">{option.label}</span>
                  <Switch
                    id={`mods-option-${mod.id}-${option.id}`}
                    label={option.label}
                    on={optionOn(option.id)}
                    onChange={(on) => setOption(option.id, on)}
                  />
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>

      <div className="vu-assistant-prompthead">
        <h4 className="vu-mods-label">Prompt</h4>
        {edited && (
          <motion.button
            id="story-assistant-reset"
            type="button"
            className="vu-pill"
            {...gestures(false, quietLift, quietPress)}
            onClick={() => void reset()}
          >
            Reset to default
          </motion.button>
        )}
      </div>
      <TextField
        id="story-assistant-prompt"
        label="What every read is written from"
        hint="Who the assistant is and what it writes. How many choices to offer is added from the option above."
        value={text}
        onChange={(value) => {
          typed.current = true
          setText(value)
          setProblem(null)
        }}
        onBlur={() => void keep(text)}
        maxLength={ASSISTANT_PROMPT_LIMIT}
        multiline
        rows={12}
      />
      {problem && (
        <p className="vu-mods-option-hint" role="alert">
          {problem}
        </p>
      )}
    </>
  )
}
