import type { ModDef } from '@vx/modkit/shared'

const mod: ModDef = {
  id: 'ghostwriter', name: 'Ghostwriter', author: 'Sharp', version: '1.0.0',
  scope: 'anytime', defaultOn: false,
  blurb: 'One model writes each scene as prose, and a second turns it into the game\'s script.',
  offNote: 'Your endpoints stay saved. Scenes go back to the game\'s own model.',
  hooks: ['invoke', 'main:registerRequestSender', 'main:modDataPath', 'sceneCall', 'modDetail', 'renderer:invoke']
}
export default mod
