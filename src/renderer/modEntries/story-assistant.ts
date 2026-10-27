import { STORY_ASSISTANT } from '@shared/storyAssistant'
import { registerHooks } from '../mods/hooks'
import { StoryAssistantPage } from '../views/StoryAssistantPage'
import { StoryAssistantPanel, StoryAssistantSeat } from '../views/StoryAssistantPanel'
import { StoryAssistantStage } from '../views/StoryAssistantStage'

registerHooks(STORY_ASSISTANT, {
  scenePlay: { Seat: StoryAssistantSeat, Panel: StoryAssistantPanel },
  stageLayer: StoryAssistantStage,
  modDetail: (mod) => (mod.id === STORY_ASSISTANT ? StoryAssistantPage : undefined)
})
