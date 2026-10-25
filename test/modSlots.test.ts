import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScreenSlot, ScreenSlotProps } from '../src/renderer/mods/hooks'

/** The places on screen: each draws the mods that are on, in list order, each kept to itself. */

type Hooks = typeof import('../src/renderer/mods/hooks')
type Slots = typeof import('../src/renderer/mods/ModSlot')

async function fresh(on: Record<string, boolean>, order: string[]): Promise<{ hooks: Hooks; slots: Slots }> {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const slots = await import('../src/renderer/mods/ModSlot')
  hooks.setHookRules({ isOn: (id) => on[id] ?? true, order: (id) => order.indexOf(id) })
  return { hooks, slots }
}

const PROPS: { [S in ScreenSlot]: ScreenSlotProps[S] } = {
  settingsSection: { theme: 'day', busy: false },
  portraitOverlay: { charId: 'c1' },
  phoneOverlay: {},
  mapOverlay: { canTravel: true, close: () => {} },
  photosPageSection: { theme: 'night' },
  stageLayer: {
    sceneMode: true,
    cinematic: false,
    covered: false,
    uiHidden: false,
    rowShown: true,
    blocked: false,
    quiz: false,
    interjectRow: null,
    awaitingInput: true
  },
  panelLayer: {
    cinematic: false,
    covered: false,
    uiHidden: false,
    blocked: false,
    panelOpen: false,
    openGameMenu: () => {}
  }
}

const SLOTS = Object.keys(PROPS) as ScreenSlot[]

/** A component that draws its mod's id and the props it was handed. */
function marker(modId: string): (props: object) => ReactElement {
  return (props) => createElement('i', { 'data-mod': modId }, JSON.stringify(props))
}

describe('a place on screen', () => {
  it.each(SLOTS)('%s draws the mods that are on, in list order, and not the one that is off', async (slot) => {
    const { hooks, slots } = await fresh({ off: false }, ['first', 'second', 'off'])
    // Registered out of order, to show the list decides.
    hooks.registerHooks('second', { [slot]: marker('second') })
    hooks.registerHooks('off', { [slot]: marker('off') })
    hooks.registerHooks('first', { [slot]: marker('first') })
    const html = renderToStaticMarkup(
      createElement(slots.ModSlot<typeof slot>, { slot, props: PROPS[slot] })
    )
    expect([...html.matchAll(/data-mod="([^"]+)"/g)].map((match) => match[1])).toEqual(['first', 'second'])
    expect(html).toContain(JSON.stringify(PROPS[slot]).replace(/"/g, '&quot;'))
  })

  it('draws nothing where no mod that is on has a component', async () => {
    const { hooks, slots } = await fresh({ off: false }, ['off'])
    hooks.registerHooks('off', { mapOverlay: marker('off') })
    const html = renderToStaticMarkup(
      createElement(slots.ModSlot<'mapOverlay'>, { slot: 'mapOverlay', props: PROPS.mapOverlay })
    )
    expect(html).toBe('')
  })
})

describe('a component that throws', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sits in a boundary of its own, apart from every other mod drawn there', async () => {
    const { hooks, slots } = await fresh({}, ['throws', 'draws'])
    const Throws = (): null => {
      throw new Error('broken mod')
    }
    const Draws = marker('draws')
    hooks.registerHooks('throws', { stageLayer: Throws })
    hooks.registerHooks('draws', { stageLayer: Draws })
    const elements = slots.slotElements('stageLayer', PROPS.stageLayer)
    expect(elements.map((element) => [element.type, element.key])).toEqual([
      [slots.SlotBoundary, 'throws'],
      [slots.SlotBoundary, 'draws']
    ])
    const inner = elements.map((element) => (element.props as { children: ReactElement }).children)
    expect(inner.map((child) => isValidElement(child) && child.type)).toEqual([Throws, Draws])
  })

  it('draws nothing once it has thrown, and the warning names the mod and the place', async () => {
    const { slots } = await fresh({}, [])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const child = createElement('i')
    const boundary = new slots.SlotBoundary({ slot: 'panelLayer', modId: 'broken', children: child })
    expect(boundary.render()).toBe(child)
    boundary.state = slots.SlotBoundary.getDerivedStateFromError()
    expect(boundary.render()).toBeNull()
    boundary.componentDidCatch(new Error('broken mod'), { componentStack: '' })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain("broken's panelLayer")
  })
})
