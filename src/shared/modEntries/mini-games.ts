import { MINI_GAMES, SUGGEST_OFTEN } from '../minigames'
import type { ModDef } from '../mods'

const def: ModDef = {
  id: MINI_GAMES,
  name: 'Mini-games',
  author: 'morrowkiln',
  version: '0.1.0',
  scope: 'anytime',
  defaultOn: true,
  blurb:
    'Play a game inside a scene, alone or with the girls who are there. This is the frame alone: the games come as mods of their own.',
  offNote: 'A game already played stays in the story and in her memories.',
  options: [
    {
      id: SUGGEST_OFTEN,
      label: 'Girls suggest games often',
      hint: 'Off, each game says how readily a girl brings it up, by place. On, she is keen to play any game wherever it can be played. Never in a class or on a shift, either way.',
      default: false
    }
  ]
}

export default def
