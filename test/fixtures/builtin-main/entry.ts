import type { InvokeContext } from '../../../src/main/mods/invoke'

/** The same exports a bundled main.js would have, returned during synchronous startup. */
export function entry() {
  return {
    invoke: {
      identity: (context: InvokeContext, value: unknown) => ({ id: context.id, value })
    },
    protocols: [{ route: 'ping', handle: () => 'built-in pong' }]
  }
}
