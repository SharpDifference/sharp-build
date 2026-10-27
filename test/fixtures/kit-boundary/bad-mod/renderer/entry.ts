// A fixture for the boundary test: each import here is one a mod may not make from the window.
import { useGameStore } from '../../../../../src/renderer/stores/gameStore'
import { screenSlot } from '@vx/modkit/host/renderer'
import type { App } from 'electron'
import { readFileSync } from 'node:fs'

export const badRenderer = [useGameStore, screenSlot, readFileSync] as const
export type A = App
