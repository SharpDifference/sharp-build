import { extname, resolve, sep } from 'path'

/**
 * Turns a `vxmod://` address into what it names: a file inside a running mod's folder, one of a
 * mod's routes, or one of the host modules served under `vxmod://host/`. Pure apart from the
 * injected `realPath`, so the Electron handler does the reading and this decides what may be read.
 */

/** One mod as the protocol serves it. */
export interface ServedMod {
  readonly id: string
  /** The absolute folder its files are read from. */
  readonly folder: string
  /** From a developer folder: answered with `Cache-Control: no-store`. */
  readonly dev: boolean
  /** Only a mod that is running is served; anything else is not found. */
  readonly loaded: boolean
}

export type Resolved =
  | { readonly kind: 'file'; readonly id: string; readonly path: string; readonly type: string; readonly dev: boolean }
  | { readonly kind: 'route'; readonly id: string; readonly route: string; readonly rest: string }
  | { readonly kind: 'shim'; readonly file: string }
  | null

/** Resolves the real path of a file, or null where it does not exist. Injected so the tests can stand in for the disk. */
export type RealPath = (path: string) => string | null

/** The host the shims for React, Motion and the kit are served under, in place of a mod id. */
export const HOST_ID = 'host'

const SCHEME = 'vxmod:'

/** A shim's file name: lower-case words and dashes, ending in `.js`. */
const SHIM_FILE = /^[a-z0-9-]+\.js$/

/** The path prefix a mod's routes answer under. */
const ROUTE_PREFIX = '/@/'

/** The content type each served extension is answered with; module scripts need a JavaScript one. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
}

/** The content type a file is served with, by its extension in any case; unknown ones are plain bytes. */
export function contentTypeOf(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** The URL parsed, or null where it does not parse or is not a `vxmod:` address. */
function parseModUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === SCHEME ? parsed : null
  } catch {
    return null
  }
}

/** The text decoded, or null where it holds a malformed escape. */
function decoded(text: string): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

/**
 * The segments of a file path, or null where any could step outside the folder or name something
 * other than a file under it: an empty segment, `.` or `..`, a backslash, a drive's colon, a NUL.
 */
function safeSegments(relative: string): string[] | null {
  if (relative === '') return null
  const segments = relative.split('/')
  const unsafe = (segment: string): boolean =>
    segment === '' || segment === '.' || segment === '..' || /[\\:\0]/.test(segment)
  return segments.some(unsafe) ? null : segments
}

/** Whether `path` lies inside `folder`, ignoring case where the file system does. */
function isInside(path: string, folder: string): boolean {
  const fold = (text: string): string => (process.platform === 'win32' ? text.toLowerCase() : text)
  return fold(path).startsWith(fold(folder + sep))
}

/** A route address: the route's name is the first segment after `/@/`, and the rest follows it. */
function resolveRoute(id: string, after: string): Resolved {
  const slash = after.indexOf('/')
  const route = decoded(slash === -1 ? after : after.slice(0, slash))
  const rest = decoded(slash === -1 ? '' : after.slice(slash + 1))
  if (!route || rest === null) return null
  return { kind: 'route', id, route, rest }
}

/** A file address: found only where its real path, symlinks followed, is still inside the mod's real folder. */
function resolveFile(mod: ServedMod, pathname: string, realPath: RealPath): Resolved {
  const path = decoded(pathname)
  if (path === null) return null
  const segments = safeSegments(path.replace(/^\//, ''))
  if (!segments) return null
  const real = realPath(resolve(mod.folder, ...segments))
  const realFolder = realPath(mod.folder)
  if (!real || !realFolder || !isInside(real, realFolder)) return null
  return { kind: 'file', id: mod.id, path: real, type: contentTypeOf(real), dev: mod.dev }
}

/**
 * What a `vxmod://` address names, or null where it names nothing that is served. A mod that is
 * missing or not running is answered exactly as a missing file is, so nothing reveals it is
 * installed. The query string and hash play no part.
 */
export function resolveModUrl(url: string, mods: ReadonlyMap<string, ServedMod>, realPath: RealPath): Resolved {
  const parsed = parseModUrl(url)
  if (!parsed) return null
  const { hostname, pathname } = parsed

  if (hostname === HOST_ID) {
    const file = pathname.slice(1)
    return pathname.startsWith('/') && SHIM_FILE.test(file) ? { kind: 'shim', file } : null
  }

  const mod = mods.get(hostname)
  if (!mod || !mod.loaded) return null
  if (pathname.startsWith(ROUTE_PREFIX)) return resolveRoute(mod.id, pathname.slice(ROUTE_PREFIX.length))
  return resolveFile(mod, pathname, realPath)
}
