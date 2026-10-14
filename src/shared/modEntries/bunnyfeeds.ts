import type { ModDef } from '../mods'
import { BUNNYFEEDS } from '../bunnyfeeds'

const mod: ModDef = {
  id: BUNNYFEEDS,
  name: 'Bunnyfeeds',
  author: 'naudh1r',
  version: '1.0.0',
  scope: 'anytime',
  defaultOn: false,
  blurb:
    "Comment on your contacts' posts and reply in their threads. The poster answers you in her own voice, her friends and other students join in, and she remembers what you said. Roster girls also comment on each other's posts. Uses one extra AI call each time you close the phone after commenting, roughly 2,000 to 4,000 tokens; browsing costs nothing. Works on its own; with Photo Feature on too, photo posts get comments the same way.",
  offNote:
    'Off, you cannot comment and posts show only Photo Feature\'s plain comments, if it is on. Threads and what she remembered are kept, and come back when it is on again.'
}
export default mod
