import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { HOST_MODULES, MAIN_SHIM_FILE } from '@shared/modSession'
import { importsOf } from '../kit/boundaryScan'

/**
 * The page's policy and its import map, held together: `script-src` carries the hash of the map
 * exactly as the file has it, so editing the map without the hash fails here and not in a
 * player's game; every directive the mods need names `vxmod:`; the map names exactly the host
 * modules main serves; and `host.ts` exposes every one of them.
 */

const ROOT = resolve(__dirname, '../..')
const html = readFileSync(resolve(ROOT, 'src/renderer/index.html'), 'utf8')

const csp = /content="([^"]*)"/.exec(/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"/.exec(html)?.[0] ?? '')?.[1] ?? ''
const importMap = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

const directives = Object.fromEntries(
  csp.split(';').map((part) => {
    const [name, ...sources] = part.trim().split(/\s+/)
    return [name, sources]
  })
)

describe("the page's policy", () => {
  it('holds the hash of the import map as the file has it', () => {
    expect(importMap).not.toBe('')
    const hash = `'sha256-${createHash('sha256').update(importMap).digest('base64')}'`
    expect(directives['script-src']).toContain(hash)
  })

  it('keeps the map on one line, so the hash does not depend on line endings', () => {
    expect(importMap).not.toMatch(/[\r\n]/)
  })

  it('names vxmod: in every directive a mod reaches, each new one keeping self', () => {
    for (const name of ['script-src', 'style-src', 'img-src', 'media-src', 'font-src', 'connect-src']) {
      expect(directives[name], name).toContain('vxmod:')
      expect(directives[name], name).toContain("'self'")
    }
    expect(directives['media-src']).toContain('blob:')
  })
})

describe('the import map', () => {
  it('maps exactly the host modules, each to its file on vxmod://host/', () => {
    const map = JSON.parse(importMap) as { imports: Record<string, string> }
    const expected = Object.fromEntries([
      ...Object.entries(HOST_MODULES).map(([file, specifier]) => [specifier, `vxmod://host/${file}`]),
      ['@vx/modkit/main', `vxmod://host/${MAIN_SHIM_FILE}`]
    ])
    expect(map).toEqual({ imports: expected })
  })

  it('is exposed whole by host.ts, which imports every module it names', () => {
    const source = readFileSync(resolve(ROOT, 'src/renderer/mods/host.ts'), 'utf8')
    const imported = importsOf(source)
    for (const specifier of Object.values(HOST_MODULES)) expect(imported, specifier).toContain(specifier)
    expect(imported).not.toContain('@vx/modkit/main')
    expect(imported).not.toContain('motion')
  })
})
