// A fixture for the boundary test: a shared file importing only what a mod may.
import { sharedModOn, type ModDef } from '@vx/modkit/shared'
import { unzipSync } from 'fflate'
import { RULE } from './rules'

export const mod: ModDef = {
  id: 'good-mod',
  name: 'Good',
  author: 'fixture',
  version: '0.0.0',
  scope: 'anytime',
  defaultOn: false,
  blurb: RULE
}

export const on = (): boolean => sharedModOn(mod.id) && typeof unzipSync === 'function'
