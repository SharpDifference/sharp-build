// A fixture for the boundary test: a main-process file importing only what a mod may.
import { readFileSync } from 'node:fs'
import { join } from 'path'
import type { App } from 'electron'
import { registerComfyLaunchEnvironment } from '@vx/modkit/main'

export const main = [readFileSync, join, registerComfyLaunchEnvironment] as const
export type MainApp = App
