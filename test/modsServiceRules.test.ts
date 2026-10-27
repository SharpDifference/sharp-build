import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Shared rules in the main process: `modsService` binds them to the switches it last read or
 * wrote, so a shared registry asked during a render sees the player's switches, not "off".
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
// This build lists no mods, so the lookup reads the switch alone.
vi.mock('@shared/mods', async (original) => ({
  ...(await original<typeof import('@shared/mods')>()),
  modOn: (switches: { on: Record<string, boolean> }, id: string) => switches.on[id] === true
}))

const { bindModSession, getModSwitches, setModSwitches } = await import('../src/main/services/modsService')
const { sharedModOn } = await import('../src/shared/modRules')
const { EMPTY_SESSION } = await import('../src/shared/modSession')

/** A session table holding `photos` at the given status. */
function sessionWith(status: 'loaded' | 'failed'): import('../src/shared/modSession').ModSessionTable {
  return {
    ...EMPTY_SESSION,
    mods: [
      {
        id: 'photos',
        manifest: null,
        def: { id: 'photos', name: 'Photos', author: 'a', version: '1.0.0', scope: 'anytime', defaultOn: true, blurb: '' },
        status,
        message: status === 'failed' ? 'main.js threw: boom' : null,
        warnings: [],
        folder: 'C:\\mods\\photos\\1.0.0',
        dev: false,
        renderer: null,
        style: null
      }
    ],
    order: status === 'loaded' ? ['photos'] : []
  }
}

describe('shared rules in main', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vu-mods-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('answer from the switches main last read, and then from the ones it last wrote', async () => {
    expect(sharedModOn('photos')).toBe(false)

    await mkdir(join(root, 'data'), { recursive: true })
    await writeFile(
      join(root, 'data', 'mods.json'),
      JSON.stringify({ schemaVersion: 1, on: { photos: true }, options: {} })
    )
    await getModSwitches()
    expect(sharedModOn('photos')).toBe(true)

    await setModSwitches({ on: { photos: false }, options: {} })
    expect(sharedModOn('photos')).toBe(false)
  })

  it('answer off for an installed mod the session table does not show as loaded, whatever its switch', async () => {
    await setModSwitches({ on: { photos: true }, options: {} })
    bindModSession(() => sessionWith('failed'))
    expect(sharedModOn('photos')).toBe(false)
    bindModSession(() => sessionWith('loaded'))
    expect(sharedModOn('photos')).toBe(true)
    bindModSession(() => EMPTY_SESSION)
    expect(sharedModOn('photos')).toBe(true)
  })
})
