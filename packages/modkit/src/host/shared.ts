/**
 * `@vx/modkit/host/shared`: core's side of the shared kit. The binder the mods store sets at boot,
 * and the runners New Game+ calls. Not for mods; the boundary test refuses it in a mod file.
 */
export { setSharedModRules } from '../shared/modRules'
export { carriedModFields, carryModFields, carryPostFields } from '../shared/modCarry'
export { checkCompat, CORE_SURFACE, hookNamesOf, manifestHooks } from '../shared/compat'
export type { Compat, CoreSurface, MissingHook } from '../shared/compat'
export { MANIFEST_SCHEMA, MOD_ID_RULE, RESERVED_MOD_IDS, parseManifest, modDefOf, hookNameKind } from '../shared/manifest'
export type { Manifest, ParsedManifest, HookNameKind } from '../shared/manifest'
