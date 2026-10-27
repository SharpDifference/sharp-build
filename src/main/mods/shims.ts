import { HOST_MODULES, HOST_SYMBOL, MAIN_SHIM_FILE } from '@shared/modSession'

/**
 * The modules served under `vxmod://host/`. The page's import map points `react`, `motion/react`
 * and the kit at them, and each one hands a mod the live module the page itself runs, which the
 * renderer parks on `globalThis` under `Symbol.for(HOST_SYMBOL)`, keyed by specifier. So a mod's
 * `import { useState } from 'react'` reaches the page's one React rather than a copy.
 */

/** The text served as `@vx/modkit/main` in the window: a module that throws on load, naming the mistake. */
export const MAIN_SHIM_TEXT =
  "throw new Error('`@vx/modkit/main` runs in the main process only; a renderer.js must not import it');"

/**
 * The text served for one host module, from the specifier and the export names the renderer
 * reported. Each named export is read into a numbered local and exported under its name as a
 * string, since an export's name need not be an identifier and may clash with any local's.
 * The exports keep the order the names came in; `default` is exported on its own.
 */
export function hostShimText(specifier: string, names: readonly string[]): string {
  const lines = [`const host = globalThis[Symbol.for(${JSON.stringify(HOST_SYMBOL)})][${JSON.stringify(specifier)}];`]
  if (names.includes('default')) lines.push('export default host.default;')
  const named = names.filter((name) => name !== 'default')
  named.forEach((name, index) => lines.push(`const $${index} = host[${JSON.stringify(name)}];`))
  if (named.length > 0) {
    const list = named.map((name, index) => `$${index} as ${JSON.stringify(name)}`).join(', ')
    lines.push(`export { ${list} };`)
  }
  return lines.join('\n') + '\n'
}

/**
 * The module text served for `vxmod://host/<file>`, or null for a file that is not a host module,
 * or whose names the renderer has not sent yet (`names` null, or no entry for the specifier).
 */
export function shimFor(file: string, names: Readonly<Record<string, readonly string[]>> | null): string | null {
  if (file === MAIN_SHIM_FILE) return MAIN_SHIM_TEXT
  if (!Object.hasOwn(HOST_MODULES, file)) return null
  const specifier = HOST_MODULES[file as keyof typeof HOST_MODULES]
  const exported = names && Object.hasOwn(names, specifier) ? names[specifier] : undefined
  return exported ? hostShimText(specifier, exported) : null
}
