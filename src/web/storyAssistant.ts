import { cleanAssistantConfig, type StoryAssistantConfig } from '@shared/storyAssistant'

/**
 * What Story Assistant keeps beside its switches on the browser build: one small record in the
 * page's own storage, as the switches are.
 */
const KEY = 'vu-story-assistant'

/** The config, or the shipped prompt standing where nothing is stored or it cannot be read. */
export function readStoryAssistantConfig(): StoryAssistantConfig {
  try {
    return cleanAssistantConfig(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return {}
  }
}

export function writeStoryAssistantConfig(config: StoryAssistantConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cleanAssistantConfig(config)))
}
