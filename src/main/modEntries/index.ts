/**
 * Built-in main entries, keyed by a mod id from MODS. List each as `() => import('./<id>')`;
 * its named `invoke` and `protocols` exports are the same ones an installed main.js exports.
 * Lazy imports let the loader catch a module that throws and switch off only its own mod.
 */
export const BUILT_IN_MAIN_ENTRIES: Readonly<Record<string, () => Promise<unknown>>> = {}
