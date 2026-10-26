// A fixture for the boundary test: each import here is one a mod may not make from shared code.
import type { Character } from '@shared/types'
import { registerHooks } from '@vx/modkit/renderer'
import { RULE } from '../../good-mod/shared/rules'

export const bad = [registerHooks, RULE] as const
export type C = Character
