import { STORY_ASSISTANT } from '@shared/storyAssistant'
import { registerHooks } from '../mods/hooks'
import { StoryAssistantPanel, StoryAssistantSeat } from '../views/StoryAssistantPanel'

registerHooks(STORY_ASSISTANT, {
  scenePlay: { Seat: StoryAssistantSeat, Panel: StoryAssistantPanel }
})
