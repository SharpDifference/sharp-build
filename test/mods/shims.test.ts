import { afterEach, describe, expect, it } from 'vitest'
import { HOST_SYMBOL } from '@shared/modSession'
import { hostShimText, MAIN_SHIM_TEXT, shimFor } from '../../src/main/mods/shims'

/**
 * The host-module shims: the text names exactly the exports the renderer reported, and a module
 * made from it hands back the page's own objects rather than copies.
 */

const key = Symbol.for(HOST_SYMBOL)
const slot = globalThis as unknown as Record<symbol, unknown>

/** The text evaluated as an ES module, the way the window loads it. */
const run = (text: string): Promise<Record<string, unknown>> =>
  import(/* @vite-ignore */ 'data:text/javascript;base64,' + Buffer.from(text).toString('base64'))

afterEach(() => {
  delete slot[key]
})

describe('hostShimText', () => {
  const text = hostShimText('react', ['default', 'useState', 'm'])

  it('exports the default and each named export, in the order the names came', () => {
    const exports = text.split('\n').filter((line) => line.startsWith('export'))
    expect(exports).toEqual(['export default host.default;', 'export { $0 as "useState", $1 as "m" };'])
  })

  it('hands back the very objects parked on the window, not copies', async () => {
    const React = { name: 'the page React' }
    const useState = (): void => {}
    const m = { motion: true }
    slot[key] = { react: { default: React, useState, m } }

    const module = await run(text)
    expect(Object.keys(module).sort()).toEqual(['default', 'm', 'useState'])
    expect(module.default).toBe(React)
    expect(module.useState).toBe(useState)
    expect(module.m).toBe(m)
  })
})

describe('shimFor', () => {
  const names = { react: ['default', 'useState'] }

  it('serves the main-process kit as a module that throws, names or none', async () => {
    expect(shimFor('kit-main.js', null)).toBe(MAIN_SHIM_TEXT)
    await expect(run(MAIN_SHIM_TEXT)).rejects.toThrow('runs in the main process only')
  })

  it('serves a host module only once its names have come, and nothing for any other file', () => {
    expect(shimFor('react.js', names)).toBe(hostShimText('react', names.react))
    expect(shimFor('react.js', null)).toBeNull()
    expect(shimFor('react-dom.js', names)).toBeNull()
    expect(shimFor('nope.js', names)).toBeNull()
  })
})
