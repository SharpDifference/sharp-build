/**
 * Who a registration belongs to: the installed mods' declared hooks, and the mod whose
 * `renderer.js` the loader is importing right now. Every registration the window kit takes
 * (`registerHooks`, `saveField`, `recordField`) is held to the same two facts.
 */

/**
 * What the loader knows about the installed mods' manifests, for a registration to be held to:
 * `declared` is a mod's `hooks` list, or undefined for a mod with no manifest (an in-repo mod),
 * and `onRefused` is told of a registration that was not kept, with the reason.
 */
export interface DeclaredHooks {
  declared: (modId: string) => readonly string[] | undefined
  onRefused: (modId: string, message: string) => void
}

let declaredHooks: DeclaredHooks | null = null

/** The mod whose `renderer.js` the loader is importing right now, or null between imports. */
let loadingModId: string | null = null

/** Hands the registrations the declared lists; null takes them away again. */
export function setDeclaredHooks(lookup: DeclaredHooks | null): void {
  declaredHooks = lookup
}

/** Names the mod being imported, so a registration made during the import is attributed to it. */
export function setLoadingMod(modId: string | null): void {
  loadingModId = modId
}

/** The declared lists as the loader set them, or null outside a loader run (the tests, the web build). */
export function declaredHooksNow(): DeclaredHooks | null {
  return declaredHooks
}

/**
 * Whether a registration of `what` under `modId` is refused for being made during another mod's
 * import; the mod being imported is told why. False outside an import.
 */
export function refusedAsForeign(modId: string, what: string): boolean {
  if (!declaredHooks || loadingModId === null || modId === loadingModId) return false
  declaredHooks.onRefused(loadingModId, `registered ${what} for \`${modId}\`, which is another mod`)
  return true
}
