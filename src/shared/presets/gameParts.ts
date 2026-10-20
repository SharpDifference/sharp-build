import { GAME_MARKERS, type GameMarker, type Preset, type PresetBlock } from './types'

/** What each game part's row is called until the player renames it. */
const MARKER_NAMES: Record<GameMarker, string> = {
  persona: 'Game persona',
  jsonRules: 'Reply rules',
  setting: 'Setting',
  reader: 'Reader',
  cast: 'Cast',
  now: 'Now',
  class: 'Class',
  lorebook: 'Lorebook',
  modLines: 'Mod lines',
  storyRecall: 'Story recall',
  storySoFar: 'Story so far',
  sceneSoFar: 'Scene so far',
  yourTurn: 'Your turn'
}

/** The row that stands for one of the game's own parts. */
export function gamePartBlock(marker: GameMarker, enabled = true): PresetBlock {
  return {
    id: `part-${marker}`,
    name: MARKER_NAMES[marker],
    role: 'system',
    enabled,
    position: 'ordered',
    depth: 0,
    marker,
    content: ''
  }
}

/**
 * The same rows with every game part present: a missing `persona` and `jsonRules` go first,
 * `yourTurn` last, and any other after the nearest part that precedes it in the shipped order.
 */
export function withGameParts(blocks: readonly PresetBlock[]): PresetBlock[] {
  const out = [...blocks]
  const has = (marker: GameMarker): boolean => out.some((b) => b.marker === marker)

  for (const marker of GAME_MARKERS) {
    if (has(marker)) continue
    const block = gamePartBlock(marker)
    if (marker === 'persona') {
      out.unshift(block)
    } else if (marker === 'jsonRules') {
      out.splice(out.findIndex((b) => b.marker === 'persona') + 1, 0, block)
    } else if (marker === 'yourTurn') {
      out.push(block)
    } else {
      const before = GAME_MARKERS.slice(0, GAME_MARKERS.indexOf(marker)).reverse()
      const anchor = before.find(has)
      out.splice(anchor ? out.findIndex((b) => b.marker === anchor) + 1 : 0, 0, block)
    }
  }
  return out
}

/** The built-in preset: the game's parts in shipped order and nothing else. */
export function nativeDefaultPreset(id: string): Preset {
  return {
    id,
    name: 'Default',
    source: 'native',
    blocks: GAME_MARKERS.map((marker) => gamePartBlock(marker))
  }
}
