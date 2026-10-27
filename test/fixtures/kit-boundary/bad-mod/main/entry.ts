// A fixture for the boundary test: each import here is one a mod may not make from the main process.
import { createElement } from 'react'
import { registerHooks } from '@vx/modkit/renderer'

export const badMain = [createElement, registerHooks] as const
