import type { JSX } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { DEFAULT_SCENE_PERSONA } from '../prompts/promptBlocks'
import type { ScreenTheme } from './clockTheme'
import { TextEditModal } from './TextEditModal'

export interface SystemPromptModalProps {
  /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
  theme: ScreenTheme
  onClose: () => void
}

/** The cast scene's own persona, opened for hand-editing over the Advanced Settings panel. */
export function SystemPromptModal({ theme, onClose }: SystemPromptModalProps): JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)

  return (
    <TextEditModal
      theme={theme}
      id="system-prompt-modal"
      idPrefix="sysprompt"
      title="Edit system prompt"
      label="System prompt"
      discardMessage="The system prompt has not been saved."
      // What is stored, or the shipped persona where nothing has replaced it.
      stored={settings?.scenePersona ?? DEFAULT_SCENE_PERSONA}
      shipped={DEFAULT_SCENE_PERSONA}
      // Cleared back to the shipped default where the two now agree.
      save={(value) =>
        update({ scenePersona: value === DEFAULT_SCENE_PERSONA ? undefined : value })
      }
      onClose={onClose}
    />
  )
}
