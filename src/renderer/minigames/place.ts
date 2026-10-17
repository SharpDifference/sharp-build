import { locationDefOf } from '@shared/locations'
import { keyPattern, LOREBOOK } from '../prompts/lorebook'
import { useGameStore } from '../stores/gameStore'

/**
 * Where the scene on screen is, as a place id the games can be matched to, or null.
 *
 * The scene's place as the classifier wrote it is an id only when the sentence named the place
 * the way the location list does. A sentence that does not ("bowling at the student lanes", an
 * invitation another mod wrote) leaves plain words there, which match no game's places. So the
 * words are read against each place's lorebook keys too, and failing that the scene's background
 * is: the place the scene shows is where the games are.
 */
export function placeOf(sceneLocation: string | null | undefined, bg: string | null | undefined): string | null {
  for (const said of [sceneLocation, bg]) {
    const place = placeNamed(said)
    if (place) return place
  }
  return null
}

/** {@link placeOf} for the scene in the store now. */
export function scenePlace(): string | null {
  const game = useGameStore.getState()
  return placeOf(game.sceneLocation, game.bg)
}

/** {@link placeOf} for the scene in the store, kept current. */
export function useScenePlace(): string | null {
  return useGameStore((s) => placeOf(s.sceneLocation, s.bg))
}

/** Each place's lorebook keys as one pattern, built once: the selector above runs on every change. */
const PLACE_PATTERNS: readonly { id: string; pattern: RegExp }[] = LOREBOOK.flatMap((entry) =>
  entry.id && locationDefOf(entry.id)
    ? [{ id: entry.id, pattern: new RegExp(entry.keys.map((key) => keyPattern(key)).join('|'), 'iu') }]
    : []
)

/** A place id from an id, a background name or a place's own words. */
function placeNamed(text: string | null | undefined): string | null {
  const raw = (text ?? '').trim().toLowerCase()
  if (!raw) return null
  const known = (id: string): string | null => (locationDefOf(id) ? id : null)

  const direct = known(raw)
  if (direct) return direct

  // A place's lorebook keys, the matcher's own patterns: "bowling", "the bowling alley", "arcade".
  const words = raw.replace(/_/g, ' ')
  for (const { id, pattern } of PLACE_PATTERNS) {
    if (!pattern.test(words)) continue
    const place = known(id)
    if (place) return place
  }
  return null
}
