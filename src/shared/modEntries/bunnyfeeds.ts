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
    "Comment on your friends' posts on Bunnyboard. She replies in her own words, her friends and other students join the conversation, and she remembers what you said. Girls also comment on each other's posts. Costs a little extra AI each time you close the phone after commenting; just scrolling is free. If Photo Feature is on too, photo posts get comments as well.",
  options: [
    {
      id: 'announce',
      label: 'Announce feed memories',
      hint: 'Off, the closing no longer says what she made of your comments; she still remembers it.',
      default: true
    }
  ],
  offNote:
    'Off, you cannot comment and posts show only Photo Feature\'s plain comments, if it is on. Threads and what she remembered are kept, and come back when it is on again.'
}
export default mod
