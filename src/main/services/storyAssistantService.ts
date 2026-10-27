import { mkdir } from 'fs/promises'
import { cleanAssistantConfig, type StoryAssistantConfig } from '@shared/storyAssistant'
import { getDataPath, getStoryAssistantPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'

/** Schema version this build reads and writes. */
const SCHEMA_VERSION = 1

/** `data/story-assistant.json` as it is on disk. */
interface StoryAssistantFile extends StoryAssistantConfig {
  schemaVersion: number
}

/** Reads `/data/story-assistant.json`; with no file yet, the shipped prompt stands. */
export async function getStoryAssistantConfig(): Promise<StoryAssistantConfig> {
  const file = await readValidatedJson<StoryAssistantFile>(getStoryAssistantPath(), {
    label: 'story-assistant.json',
    unreadable: { code: 'STORY_ASSISTANT_UNREADABLE', message: 'Could not read story-assistant.json.' },
    malformed: {
      code: 'STORY_ASSISTANT_MALFORMED',
      message: 'story-assistant.json is not valid JSON. Fix or delete the file to continue.'
    },
    schemaVersion: { code: 'STORY_ASSISTANT_SCHEMA_VERSION' },
    expects: SCHEMA_VERSION,
    required: { schemaVersion: true },
    onMissing: () => ({ schemaVersion: SCHEMA_VERSION })
  })
  return cleanAssistantConfig(file)
}

/** Writes the config atomically. */
export async function setStoryAssistantConfig(config: StoryAssistantConfig): Promise<void> {
  await mkdir(getDataPath(), { recursive: true })
  await writeAtomicJson(
    getStoryAssistantPath(),
    { schemaVersion: SCHEMA_VERSION, ...cleanAssistantConfig(config) },
    { code: 'STORY_ASSISTANT_UNWRITABLE', message: 'Could not save story-assistant.json.' }
  )
}
