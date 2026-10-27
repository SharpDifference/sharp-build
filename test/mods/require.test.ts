import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireMain, UndeclaredApiError, type MainContext } from '../../src/main/mods/require'

/**
 * A mod's `main.js` run with the loader's own `require`: the kit answers only what the manifest
 * declares, a library is reached as `vxmod:<id>` only where it is required, Node's own modules
 * come through, a file of the mod's own must stay in its folder, and anything else must have been
 * bundled.
 */

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-require-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function main(source: string, over: Partial<MainContext> = {}): Promise<unknown> {
  const folder = join(root, 'mod')
  await mkdir(folder, { recursive: true })
  const file = join(folder, 'main.js')
  await writeFile(file, source)
  return requireMain({
    id: 'mod',
    folder,
    file,
    declared: new Set(['main:registerComfyLaunchEnvironment']),
    dependencies: new Set(['lib']),
    libraries: new Map([['lib', { greet: () => 'hello' }]]),
    ...over
  })
}

describe('requiring main.js', () => {
  it('answers module.exports, with __filename and __dirname naming the file', async () => {
    const exported = (await main("module.exports = { file: __filename, dir: __dirname, protocols: [] }")) as { file: string; dir: string }
    expect(exported.file).toBe(join(root, 'mod', 'main.js'))
    expect(exported.dir).toBe(join(root, 'mod'))
  })

  it('hands over a declared kit API and throws on an undeclared one', async () => {
    const exported = (await main("module.exports = typeof require('@vx/modkit/main').registerComfyLaunchEnvironment")) as string
    expect(exported).toBe('function')
    await expect(main("require('@vx/modkit/shared').modOn")).rejects.toBeInstanceOf(UndeclaredApiError)
    await expect(main("require('@vx/modkit/shared').modOn")).rejects.toThrow('`shared:modOn` is not declared in vxmod.json')
  })

  it('resolves vxmod:<id> for a dependency and refuses it for anything else', async () => {
    expect(await main("module.exports = require('vxmod:lib').greet()")).toBe('hello')
    await expect(main("require('vxmod:other')")).rejects.toThrow('`vxmod:other` is not in requires or optional')
    await expect(main("require('vxmod:lib')", { libraries: new Map() })).rejects.toThrow('has no main.js to require')
  })

  it("passes Node's own modules through, and refuses a package that was not bundled", async () => {
    expect(await main("module.exports = typeof require('node:path').join")).toBe('function')
    expect(await main("module.exports = typeof require('fs').readFileSync")).toBe('function')
    await expect(main("require('lodash')")).rejects.toThrow('cannot require "lodash": a dependency must be bundled into main.js')
  })

  it("requires a file of the mod's own and refuses one outside its folder", async () => {
    await mkdir(join(root, 'mod'), { recursive: true })
    await writeFile(join(root, 'mod', 'helper.js'), "module.exports = 'helped'")
    await writeFile(join(root, 'outside.js'), "module.exports = 'escaped'")
    expect(await main("module.exports = require('./helper.js')")).toBe('helped')
    await expect(main("require('../outside.js')")).rejects.toThrow("is outside the mod's folder")
  })

  it('names the file in a stack trace', async () => {
    await expect(main("throw new Error('at top level')")).rejects.toSatisfy((err: Error) => err.stack?.includes(join(root, 'mod', 'main.js')) === true)
  })
})
