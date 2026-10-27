import { net, protocol, type CustomScheme } from 'electron'
import { realpathSync } from 'fs'
import { pathToFileURL } from 'url'
import type { RouteHandler } from './loader'
import { resolveModUrl, type ServedMod } from './resolve'
import { shimFor } from './shims'

/**
 * The `vxmod://` protocol: installed mods' files from their one folder, their routes, and the
 * host shims that hand a mod the page's own React and kit. Registered before `ready` as a
 * standard, secure scheme with CORS, because the page is `file://` in production and
 * `http://localhost` in dev, both other origins than `vxmod://<id>`.
 */

export const VXMOD_SCHEME = 'vxmod'

/** What the loader hands the handler, read on every request so a session that changes is served as it stands. */
export interface ServedSession {
  served: () => ReadonlyMap<string, ServedMod>
  routes: () => ReadonlyMap<string, ReadonlyMap<string, RouteHandler>>
  /** Each host module's export names as the renderer reported them; null until it has. */
  hostNames: () => Readonly<Record<string, readonly string[]>> | null
}

/** The scheme's entry in the one `registerSchemesAsPrivileged` call. */
export function modScheme(): CustomScheme {
  return {
    scheme: VXMOD_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
}

const realPath = (path: string): string | null => {
  try {
    return realpathSync.native(path)
  } catch {
    return null
  }
}

/** The headers every answer carries: the page's origin is never `vxmod://`, and a dev folder is never cached. */
function headersFor(type: string, dev: boolean): Record<string, string> {
  return {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    ...(dev ? { 'Cache-Control': 'no-store' } : {})
  }
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: headersFor('text/plain', false) })
}

/** A route's answer as a `Response`: one it returned as is, text or bytes wrapped, and the CORS header on either. */
function routeResponse(answer: Response | string | Uint8Array): Response {
  const response = answer instanceof Response ? answer : new Response(answer as BodyInit, { status: 200 })
  if (response.headers.has('Access-Control-Allow-Origin')) return response
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

/** Must run **after** `app.whenReady()`. */
export function handleModProtocol(session: ServedSession): void {
  protocol.handle(VXMOD_SCHEME, async (request) => {
    const resolved = resolveModUrl(request.url, session.served(), realPath)
    if (resolved === null) return notFound()

    if (resolved.kind === 'shim') {
      const text = shimFor(resolved.file, session.hostNames())
      if (text === null) return notFound()
      return new Response(text, { headers: headersFor('text/javascript', false) })
    }

    if (resolved.kind === 'route') {
      const handler = session.routes().get(resolved.id)?.get(resolved.route)
      if (!handler) return notFound()
      try {
        return routeResponse(await handler(request))
      } catch (err) {
        // The mod stays on: one bad answer is the route's, not the session's.
        console.error(`[mods] ${resolved.id}: route ${resolved.route} threw:`, err)
        return new Response('The mod\'s route failed', { status: 500, headers: headersFor('text/plain', false) })
      }
    }

    const file = await net.fetch(pathToFileURL(resolved.path).toString())
    if (!file.ok) return notFound()
    return new Response(file.body, { status: 200, headers: headersFor(resolved.type, resolved.dev) })
  })
}
