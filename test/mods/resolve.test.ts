import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { contentTypeOf, resolveModUrl, type RealPath, type ServedMod } from '../../src/main/mods/resolve'

/**
 * The `vxmod://` addresses: what each one names, and that nothing outside a running mod's own
 * folder is ever named, whatever the address spells.
 */

const FOLDER = resolve('/vx/mods/hello-mod/1.0.0')
const OUTSIDE = resolve('/vx/secret.js')

/** The disk the tests stand on: each existing path, mapped to its real path. */
const disk = new Map<string, string>([
  [FOLDER, FOLDER],
  [resolve(FOLDER, 'renderer.js'), resolve(FOLDER, 'renderer.js')],
  [resolve(FOLDER, 'assets/art/cover.png'), resolve(FOLDER, 'assets/art/cover.png')],
  [resolve(FOLDER, 'link.js'), OUTSIDE],
  [OUTSIDE, OUTSIDE]
])
const realPath: RealPath = (path) => disk.get(path) ?? null

const mod = (id: string, more: Partial<ServedMod> = {}): ServedMod => ({
  id,
  folder: FOLDER,
  dev: false,
  loaded: true,
  ...more
})

const mods = new Map<string, ServedMod>([
  ['hello-mod', mod('hello-mod', { dev: true })],
  ['sleeping-mod', mod('sleeping-mod', { loaded: false })]
])

const at = (url: string): ReturnType<typeof resolveModUrl> => resolveModUrl(url, mods, realPath)

describe('resolveModUrl', () => {
  it('serves a mod file from its folder, as JavaScript, carrying whether it is a dev folder', () => {
    expect(at('vxmod://hello-mod/renderer.js')).toEqual({
      kind: 'file',
      id: 'hello-mod',
      path: resolve(FOLDER, 'renderer.js'),
      type: 'text/javascript',
      dev: true
    })
  })

  it('serves an asset in a subfolder and ignores the query string and hash', () => {
    expect(at('vxmod://hello-mod/assets/art/cover.png?v=3#top')).toMatchObject({
      kind: 'file',
      path: resolve(FOLDER, 'assets/art/cover.png'),
      type: 'image/png'
    })
  })

  it('never climbs out of the folder through dot segments, plain or encoded', () => {
    for (const url of [
      'vxmod://hello-mod/../secret.js',
      'vxmod://hello-mod/%2e%2e/secret.js',
      'vxmod://hello-mod/assets%2f..%2f..%2fsecret.js',
      'vxmod://hello-mod/assets/%2E%2E%2F%2E%2E%2Fsecret.js'
    ]) {
      expect(at(url), url).toBeNull()
    }
  })

  it('refuses a drive letter and a backslash', () => {
    expect(at('vxmod://hello-mod/C:/Windows/x')).toBeNull()
    expect(at('vxmod://hello-mod/assets%5C..%5Crenderer.js')).toBeNull()
    expect(at('vxmod://hello-mod/assets\\renderer.js')).toBeNull()
  })

  it('refuses a symlink whose target lies outside the folder', () => {
    expect(at('vxmod://hello-mod/link.js')).toBeNull()
  })

  it('answers a missing file, an unknown mod and a mod that is not running alike: not found', () => {
    expect(at('vxmod://hello-mod/missing.js')).toBeNull()
    expect(at('vxmod://nobody/renderer.js')).toBeNull()
    expect(at('vxmod://sleeping-mod/renderer.js')).toBeNull()
    expect(at('vxmod://sleeping-mod/@/status')).toBeNull()
  })

  it('serves the host shims by file name, and only well-formed names', () => {
    expect(at('vxmod://host/react-jsx-runtime.js')).toEqual({ kind: 'shim', file: 'react-jsx-runtime.js' })
    expect(at('vxmod://host/React.js')).toBeNull()
    expect(at('vxmod://host/sub/react.js')).toBeNull()
    expect(at('vxmod://host/react.css')).toBeNull()
  })

  it('reads a route by its name, with whatever follows it decoded', () => {
    expect(at('vxmod://hello-mod/@/status')).toEqual({ kind: 'route', id: 'hello-mod', route: 'status', rest: '' })
    expect(at('vxmod://hello-mod/@/save/slot%201/data?x=1')).toEqual({
      kind: 'route',
      id: 'hello-mod',
      route: 'save',
      rest: 'slot 1/data'
    })
    expect(at('vxmod://hello-mod/@/')).toBeNull()
  })

  it('names nothing for another scheme or an address that does not parse', () => {
    expect(at('file:///vx/mods/hello-mod/1.0.0/renderer.js')).toBeNull()
    expect(at('not a url')).toBeNull()
    expect(at('vxmod://hello-mod/%E0%A4%A.js')).toBeNull()
  })
})

describe('contentTypeOf', () => {
  it('answers by extension in any case, and plain bytes for anything unknown', () => {
    expect(contentTypeOf('a/renderer.mjs')).toBe('text/javascript')
    expect(contentTypeOf('style.css')).toBe('text/css')
    expect(contentTypeOf('COVER.PNG')).toBe('image/png')
    expect(contentTypeOf('icon.svg')).toBe('image/svg+xml')
    expect(contentTypeOf('theme.ogg')).toBe('audio/ogg')
    expect(contentTypeOf('font.woff2')).toBe('font/woff2')
    expect(contentTypeOf('engine.wasm')).toBe('application/wasm')
    expect(contentTypeOf('notes.md')).toBe('application/octet-stream')
    expect(contentTypeOf('Makefile')).toBe('application/octet-stream')
  })
})
