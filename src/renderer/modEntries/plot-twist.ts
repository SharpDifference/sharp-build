import { PLOT_TWIST_MOD } from '@shared/plotTwists'
import { plotTwistBlock } from '../prompts/plotTwist'
import { registerHooks } from '../mods/hooks'
import { createElement, lazy, Suspense } from 'react'
import type { GameModalProps, ScreenSlotProps } from '@vx/modkit/renderer'

// Keep the prompt-only registration independent of screen stores and bridge listeners.
const screens = () => import('../views/PlotTwistEntry')
const Menu = lazy(() => screens().then(module => ({ default: module.PlotTwistMenuEntry })))
const Panel = lazy(() => screens().then(module => ({ default: module.PlotTwistPanel })))

registerHooks(PLOT_TWIST_MOD, {
  gameMenuEntry: (props: ScreenSlotProps['gameMenuEntry']) => createElement(Suspense, { fallback: null }, createElement(Menu, props)),
  gameModals: {
    'plot-twist': (props: GameModalProps) => createElement(Suspense, { fallback: null }, createElement(Panel, props))
  },
  prompts: { scene: { lines: ({ state }) => plotTwistBlock(state.exPlotTwist) } }
})
