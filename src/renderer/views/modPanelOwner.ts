import { gameModal, scenePlays } from '../mods/hooks'

/** The game view's two kinds of mod panel: one opened from a rail seat, one by `openPanel`. */
export type ModPanelRef = { kind: 'modPanel'; modId: string } | { kind: 'gameModal'; id: string }

/**
 * Whether no mod that is on draws this panel any more: a rail seat whose mod is off, or an
 * `openPanel` id no mod that is on has a panel under. The game view closes such a panel, so it
 * cannot hold the screen with nothing drawn on it.
 */
export function modPanelGone(panel: ModPanelRef): boolean {
  if (panel.kind === 'gameModal') return gameModal(panel.id) === undefined
  return !scenePlays().some(({ modId }) => modId === panel.modId)
}
