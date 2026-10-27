import type { ModDef } from '../mods'
import { STORY_ASSISTANT } from '../storyAssistant'

const mod: ModDef = {
  id: STORY_ASSISTANT,
  name: 'Story Assistant',
  author: 'mtabbada',
  version: '1.0.0',
  scope: 'anytime',
  defaultOn: false,
  blurb:
    'A friend reading over your shoulder: on your turn in a scene, ask what they make of it and pick from a few ways forward. Each ask is one call to your writer.',
  offNote: 'It keeps nothing in your saves, and changes nothing in the story until you send a turn.'
}
export default mod
