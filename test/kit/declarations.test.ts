import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * The kit's declaration build, which its API report is made from, compiles a mod's augmentation
 * of a core module it carries data in: the augmented module must be in the build's program even
 * where nothing the kit reaches imports it.
 */

const ROOT = resolve(__dirname, '../..')

describe("the kit's declaration build", () => {
  it("takes a mod's augmentation of core's backup module", () => {
    const tsc = spawnSync(
      process.execPath,
      [
        resolve(ROOT, 'node_modules/typescript/bin/tsc'),
        '-p',
        resolve(ROOT, 'test/fixtures/kit-dts/tsconfig.json'),
        '--noEmit'
      ],
      { cwd: ROOT, encoding: 'utf8' }
    )
    expect(tsc.stdout + tsc.stderr).toBe('')
    expect(tsc.status).toBe(0)
  }, 60_000)
})
