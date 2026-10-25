import { Component, useSyncExternalStore, type ErrorInfo, type JSX, type ReactNode } from 'react'
import { screenSlot, subscribeHookRules, type ScreenSlot, type ScreenSlotProps } from './hooks'

/**
 * Every mod's component for one place on screen: each mod that is on, in list order, drawn again
 * when a switch moves. A component that throws draws nothing, and the screen around it stands.
 */
export function ModSlot<S extends ScreenSlot>({
  slot,
  props
}: {
  slot: S
  props: ScreenSlotProps[S]
}): JSX.Element {
  useSyncExternalStore(subscribeHookRules, () => slotKey(slot), () => slotKey(slot))
  return <>{slotElements(slot, props)}</>
}

/** Each drawn mod's component at a place, inside a boundary of its own keyed by the mod's id. */
export function slotElements<S extends ScreenSlot>(slot: S, props: ScreenSlotProps[S]): JSX.Element[] {
  return screenSlot(slot).map(({ modId, Component: Drawn }) => (
    <SlotBoundary key={modId} slot={slot} modId={modId}>
      <Drawn {...props} />
    </SlotBoundary>
  ))
}

/** The ids of the mods drawn at a place, as one string that changes only when they do. */
function slotKey(slot: ScreenSlot): string {
  return screenSlot(slot)
    .map((entry) => entry.modId)
    .join('\n')
}

/** One mod's component at a place: nothing from the moment it throws. */
export class SlotBoundary extends Component<
  { slot: ScreenSlot; modId: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.warn(`[mods] ${this.props.modId}'s ${this.props.slot} failed`, error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
