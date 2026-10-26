import { appError } from '@shared/errors'

/** Facts available just before the game's managed ComfyUI process is spawned. */
export interface ComfyLaunchContext {
  /** The same managed installation root used as the child's working directory. */
  readonly root: string
  readonly platform: NodeJS.Platform
}

type EnvironmentProvider = (context: Readonly<ComfyLaunchContext>) => Readonly<Record<string, string>> | null
const providers = new Map<string, { provide: EnvironmentProvider }>()

/** Trusted main-process setup only; the owner removes its registration when deactivated. */
export function registerComfyLaunchEnvironment(modId: string, provider: EnvironmentProvider): () => void {
  if (!modId.trim() || modId !== modId.trim() || typeof provider !== 'function') {
    throw Error('A ComfyUI launch environment needs an owner and a provider.')
  }
  if (providers.has(modId)) throw Error(`ComfyUI launch environment is already registered by ${modId}.`)
  const entry = { provide: provider }
  providers.set(modId, entry)
  return () => { if (providers.get(modId) === entry) providers.delete(modId) }
}

/**
 * Additive keys; equal answers coalesce, conflicting answers fail before spawn. No provider
 * means native inheritance. Never writes process.env or changes an already-running server.
 */
export function comfyLaunchEnvironment(
  context: ComfyLaunchContext,
  inherited: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv | undefined {
  const result = { ...inherited }
  const normalized = (key: string): string => context.platform === 'win32' ? key.toUpperCase() : key
  const claimed = new Map<string, { key: string; value: string; owner: string }>()
  const snapshot = Object.freeze({ ...context })
  const ordered = [...providers].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  for (const [owner, { provide }] of ordered) {
    let added: ReturnType<EnvironmentProvider>
    try { added = provide(snapshot) } catch {
      throw appError('COMFY_ENV_PROVIDER', `ComfyUI could not start: ${owner}'s launch environment failed.`)
    }
    if (added === null) continue
    if (!added || typeof added !== 'object' ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(added))) {
      throw appError('COMFY_ENV_INVALID', `ComfyUI could not start: ${owner} returned an invalid launch environment.`)
    }
    for (const key of Object.keys(added).sort()) {
      const value = added[key]
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string' || value.includes('\0')) {
        throw appError('COMFY_ENV_INVALID', `ComfyUI could not start: ${owner} returned an invalid environment entry.`)
      }
      const id = normalized(key)
      const previous = claimed.get(id)
      if (previous && previous.value !== value) {
        throw appError('COMFY_ENV_CONFLICT',
          `ComfyUI could not start: ${previous.owner} and ${owner} disagree on ${previous.key}.`)
      }
      if (!previous) claimed.set(id, { key, value, owner })
    }
  }
  if (!claimed.size) return undefined
  for (const { key, value } of claimed.values()) {
    // On Windows an override must replace every spelling of an inherited name (Path/PATH).
    for (const name of Object.keys(result)) if (normalized(name) === normalized(key)) delete result[name]
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true })
  }
  return result
}
