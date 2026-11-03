import type { InvokeContext } from '../../../src/main/mods/invoke'

/** The same exports a bundled main.js would have. */
export const invoke = {
  identity: (context: InvokeContext, value: unknown) => ({ id: context.id, value })
}

export const protocols = [{ route: 'ping', handle: () => 'built-in pong' }]
