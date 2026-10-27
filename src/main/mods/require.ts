import { readFileSync, realpathSync, statSync } from 'fs'
import { createRequire, isBuiltin } from 'module'
import { dirname, extname, resolve, sep } from 'path'
import { compileFunction } from 'vm'
import * as kitShared from '@vx/modkit/shared'
import * as kitMain from '@vx/modkit/main'

/**
 * Requiring a mod's `main.js`: one CommonJS file with its dependencies bundled, run with a
 * `require` of the loader's rather than Node's, because its imports of the kit must reach core's
 * own copy, which is bundled into `out/main/index.js` and has no file to resolve to. A file of the
 * mod's own that it requires is compiled and run the same way, with the same `require`, so the kit
 * proxy and the folder check hold for every file the mod runs; a `.node` addon is the one thing
 * handed to Node's own loader.
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

/** A module as its code sees it: `module.exports`, or what is there so far while it runs. */
interface Module {
  exports: unknown
}

/**
 * A {@link MainContext} during one `requireMain`: `file` is the file being run, and `modules`
 * holds every file of the mod's run so far, by real path, so each runs once and a require cycle
 * gets the partial exports.
 */
interface Loading extends MainContext {
  readonly modules: Map<string, Module>
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

/** Whether `path` is a file. */
function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true
}

/** The file a relative specifier names: the exact path, else the path with `.js`, `.json` or `.node` appended. */
function fileFor(path: string): string | null {
  return [path, `${path}.js`, `${path}.json`, `${path}.node`].find(isFile) ?? null
}

/** Whether `path` is `folder` or under it, after symlinks, as Windows compares paths. */
function inside(path: string, folder: string): boolean {
  const normalize = (p: string): string => (process.platform === 'win32' ? p.toLowerCase() : p)
  return normalize(path) === normalize(folder) || normalize(path).startsWith(normalize(folder) + sep)
}

/** The `require` a file of the mod's is handed. */
function requireFor(ctx: Loading): (specifier: string) => unknown {
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
      const file = fileFor(resolve(dirname(ctx.file), specifier))
      const real = file === null ? null : realPathOf(file)
      const folder = realPathOf(ctx.folder)
      if (real === null || folder === null || !inside(real, folder)) {
        throw new Error(`\`${specifier}\` is outside the mod's folder, or does not exist`)
      }
      const loaded = ctx.modules.get(real)
      if (loaded !== undefined) return loaded.exports
      const extension = extname(real).toLowerCase()
      if (extension === '.node') return nodeRequire(real)
      if (extension === '.json') {
        const module: Module = { exports: JSON.parse(readFileSync(real, 'utf8')) }
        ctx.modules.set(real, module)
        return module.exports
      }
      return run({ ...ctx, file: real }, real)
    }
    throw new Error(`cannot require "${specifier}": a dependency must be bundled into main.js`)
  }
}

/**
 * Compiles and runs `ctx.file` as CommonJS, registered in `ctx.modules` under `key` before it
 * runs, and answers its `module.exports`. Stack traces name the file. A throw comes out as is and
 * drops the file from `ctx.modules`, so a later require runs it again.
 */
function run(ctx: Loading, key: string): unknown {
  const source = readFileSync(ctx.file, 'utf8')
  const compiled = compileFunction(source, ['exports', 'require', 'module', '__filename', '__dirname'], {
    filename: ctx.file
  })
  const module: Module = { exports: {} }
  ctx.modules.set(key, module)
  try {
    compiled(module.exports, requireFor(ctx), module, ctx.file, dirname(ctx.file))
  } catch (err) {
    ctx.modules.delete(key)
    throw err
  }
  return module.exports
}

/**
 * Compiles and runs a mod's `main.js` and answers its `module.exports`. A throw at top level, or a
 * read of an undeclared kit API, in it or in any file it requires, comes out as is.
 */
export function requireMain(ctx: MainContext): unknown {
  return run({ ...ctx, modules: new Map() }, realPathOf(ctx.file) ?? ctx.file)
}
