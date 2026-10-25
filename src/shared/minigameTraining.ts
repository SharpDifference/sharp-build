import type { MiniGameDef } from './minigames'
import type { LedgerStats, PlayerStats, StatContext, StatKey, StatusText } from './playerStats'
import { resolveStatDeltas, STAT_KEYS, STAT_LABELS } from './playerStats'
import type { SlotActivity, SlotActivityOffer } from './slotActivity'

/** One row per available game/place, shared by offering and revalidation. */
export function trainingOffers(
  owner: string, stat: StatKey, games: readonly MiniGameDef[],
  enabled: (game: MiniGameDef) => boolean,
  placeLabel: (id: string) => string | null
): SlotActivityOffer[] {
  return games.flatMap(game => {
    if (game.trainingStat !== stat || game.players.min !== 0 || !enabled(game)) return []
    return (game.locations ?? []).flatMap(location => {
      const place = placeLabel(location)
      return place ? [{ owner, id: game.id, stat, location,
        label: `Improve ${STAT_LABELS[stat]} ${game.trainingActivity ?? `by playing ${game.name}`} at ${place}.` }] : []
    })
  })
}

/** The lines in `lines` that `without` does not also have. */
function linesBeyond(lines: readonly StatusText[], without: readonly StatusText[]): StatusText[] {
  return lines.filter((line) => !without.some((other) => other.text === line.text))
}

/**
 * A training slot's stats: what the ledger said the hour exercised gives way to the activity's
 * own stat, paid only if it was completed and on the game's own terms, a point with company and
 * two alone. Whatever else the scene settled, an earlier mod's change included, stands.
 */
export function trainedSceneStats(
  settled: { deltas: PlayerStats; lines: StatusText[] },
  ledger: LedgerStats | undefined,
  ctx: StatContext,
  activity: SlotActivity
): { deltas: PlayerStats; lines: StatusText[] } {
  const trained: LedgerStats = activity.status === 'completed' ? { [activity.stat]: true } : {}
  const neither = resolveStatDeltas(undefined, ctx)
  const asLedger = resolveStatDeltas(ledger, ctx)
  const asTrained = resolveStatDeltas(trained, ctx)
  const dropped = linesBeyond(asLedger.lines, neither.lines)
  const deltas = { ...settled.deltas }
  for (const key of STAT_KEYS) deltas[key] += asTrained.deltas[key] - asLedger.deltas[key]
  return {
    deltas,
    // Exercise leads the scene's lines, as the game writes them.
    lines: [...linesBeyond(asTrained.lines, neither.lines), ...linesBeyond(settled.lines, dropped)]
  }
}
