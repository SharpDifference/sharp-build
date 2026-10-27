import { readFileSync, realpathSync } from 'fs'
import { createRequire, isBuiltin } from 'module'
import { dirname, resolve, sep } from 'path'
import { compileFunction } from 'vm'
import * as kitShared from '@vx/modkit/shared'
import * as kitMain from '@vx/modkit/main'

/**
 * Requiring a mod's `main.js`: one CommonJS file with its dependencies bundled, run with a
 * `require` of the loader's rather than Node's, because its imports of the kit must reach core's
 * own copy, which is bundled into `out/main/index.js` and has no file to resolve to.
 */

/** What the loader knows about the mod whose `main.js` is being required. */
export interface MainContext {
  readonly id: string
  /** The folder the mod runs from; a relative `require` must stay inside it. */
  readonly folder: string
  /** The absolute path of its `main.js`. */
  readonly file: string
  /** Every name the manifest's `hooks` list declares. */
  readonly declared: ReadonlySet<string>
  /** The ids the manifest names in `requires`, and in `optional` where those are installed. */
  readonly dependencies: ReadonlySet<string>
  /** What each loaded dependency's `main.js` exported, by id, for `vxmod:<id>`. */
  readonly libraries: ReadonlyMap<string, unknown>
}

/** A read of a kit API the manifest does not declare: the build and the manifest disagree. */
export class UndeclaredApiError extends Error {
  constructor(readonly api: string) {
    super(`\`${api}\` is not declared in vxmod.json`)
    this.name = 'UndeclaredApiError'
  }
}

/** Reads a module's own bookkeeping keys pass through; everything else is an API the mod must declare. */
const PASS_THROUGH = new Set<string | symbol>(['__esModule', 'default', 'then'])

/**
 * Core's kit module, answering only the APIs the manifest declares. A read of any other throws
 * {@link UndeclaredApiError}, which refuses the mod: main is the one side where the kit's API list
 * can be enforced at run time for free.
 */
function kitProxy<T extends object>(target: T, side: 'shared' | 'main', declared: ReadonlySet<string>): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === 'symbol' || PASS_THROUGH.has(property)) {
        if (property === 'default') return receiver
        if (property === '__esModule') return true
        return Reflect.get(object, property, receiver)
      }
      const api = `${side}:${property}`
      if (!declared.has(api)) throw new UndeclaredApiError(api)
      return Reflect.get(object, property, receiver)
    }
  })
}

/** The real path of a file, or null where there is none. */
function realPathOf(path: string): string | null {
  try {
    return realpathSync.native(path)
  } catch {
    return null
  }
}

/** Whether `path` is `folder` or under it, after symlinks, as Windows compares paths. */
function inside(path: string, folder: string): boolean {
  const normalize = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p)
  return normalize(path) === normalize(folder) || normalize(path).startsWith(normalize(folder) + sep)
}

/** The `require` a mod's `main.js` is handed. */
function requireFor(ctx: MainContext): (specifier: string) => unknown {
  const nodeRequire = createRequire(ctx.file)
  return (specifier: string): unknown => {
    if (specifier === '@vx/modkit/shared') return kitProxy(kitShared, 'shared', ctx.declared)
    if (specifier === '@vx/modkit/main') return kitProxy(kitMain, 'main', ctx.declared)
    if (specifier === '@vx/modkit/renderer') {
      throw new Error('`@vx/modkit/renderer` runs in the window only; a main.js must not require it')
    }
    if (specifier.startsWith('vxmod:')) {
      const id = specifier.slice('vxmod:'.length)
      if (!ctx.dependencies.has(id)) throw new Error(`\`${specifier}\` is not in requires or optional`)
      if (!ctx.libraries.has(id)) throw new Error(`\`${specifier}\` has no main.js to require`)
      return ctx.libraries.get(id)
    }
    if (specifier === 'electron' || isBuiltin(specifier)) return nodeRequire(specifier)
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const real = realPathOf(resolve(dirname(ctx.file), specifier))
      const folder = realPathOf(ctx.folder)
      if (real === null || folder === null || !inside(real, folder)) {
        throw new Error(`\`${specifier}\` is outside the mod's folder, or does not exist`)
      }
      return nodeRequire(real)
    }
    throw new Error(`cannot require "${specifier}": a dependency must be bundled into main.js`)
  }
}

/**
 * Compiles and runs a mod's `main.js` and answers its `module.exports`. Stack traces name the
 * mod's file. A throw at top level, or a read of an undeclared kit API, comes out as is.
 */
export function requireMain(ctx: MainContext): unknown {
  const source = readFileSync(ctx.file, 'utf8')
  const run = compileFunction(source, ['exports', 'require', 'module', '__filename', '__dirname'], {
    filename: ctx.file
  })
  const module = { exports: {} as unknown }
  run(module.exports, requireFor(ctx), module, ctx.file, dirname(ctx.file))
  return module.exports
}
