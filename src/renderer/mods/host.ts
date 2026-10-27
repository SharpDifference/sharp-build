import * as React from 'react'
import * as JsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as MotionReact from 'motion/react'
import * as KitShared from '@vx/modkit/shared'
import * as KitRenderer from '@vx/modkit/renderer'
import { HOST_MODULES, HOST_SYMBOL } from '@shared/modSession'

/**
 * One React: a mod's `renderer.js` keeps `react`, `motion/react` and the kit external, and the
 * page's import map sends those names to `vxmod://host/<file>.js`, small modules main generates.
 * A module's identity is its URL, so those modules cannot import the game's own files (that would
 * be a second copy, and every hook a mod's component calls would fail); they reach the live
 * instances through the window instead. This parks each namespace, frozen, where the shims read
 * it, and tells main each one's export names, so the shim always matches the instance it points
 * at and a React update needs nothing from us. The mod-facing kit entries only, never `host/*`.
 */

type Specifier = (typeof HOST_MODULES)[keyof typeof HOST_MODULES]

const modules: Readonly<Record<Specifier, object>> = {
  react: React,
  'react/jsx-runtime': JsxRuntime,
  'react-dom': ReactDom,
  'react-dom/client': ReactDomClient,
  'motion/react': MotionReact,
  '@vx/modkit/shared': KitShared,
  '@vx/modkit/renderer': KitRenderer
}

let exposed: Promise<void> | null = null

/** Parks the host modules and sends their names once; the first installed mod is imported after this settles. */
export function exposeHost(): Promise<void> {
  if (exposed) return exposed
  exposed = (async () => {
    const parked = Object.freeze(Object.fromEntries(Object.entries(modules).map(([name, module]) => [name, Object.freeze({ ...module, default: (module as { default?: unknown }).default ?? module })])))
    ;(globalThis as Record<symbol, unknown>)[Symbol.for(HOST_SYMBOL)] = parked
    const names = Object.fromEntries(Object.entries(parked).map(([name, module]) => [name, Object.keys(module)]))
    const result = await window.api.mods.exposeHost(names)
    if (!result.ok) throw new Error(result.error.message)
  })()
  return exposed
}
