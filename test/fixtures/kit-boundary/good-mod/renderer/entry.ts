// A fixture for the boundary test: a renderer file importing only what a mod may.
import { createElement } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { registerHooks, useModOn } from '@vx/modkit/renderer'
import { KIT_VERSION } from '@vx/modkit/shared'
import { RULE } from '../shared/rules'
import { Panel } from './panel'

export function register(): void {
  registerHooks('good-mod', { playerActs: () => void Panel })
}

export const bits = [createElement, createPortal, motion, useModOn, KIT_VERSION, RULE] as const
