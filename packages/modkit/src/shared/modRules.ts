/** Shared rules ask the renderer's live lookup without importing renderer stores. */
let isOn: (modId: string) => boolean = () => false

/** Bind once at boot; the supplied lookup reads current switches and playthrough selection. */
export function setSharedModRules(lookup: (modId: string) => boolean): void {
  isOn = lookup
}

/** With no renderer binding (including main-process code), optional effects stay off. */
export function sharedModOn(modId: string): boolean {
  return isOn(modId)
}
