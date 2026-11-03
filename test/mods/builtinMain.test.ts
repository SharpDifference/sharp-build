import { cpSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installMods, MODS, setInstalledMods, type ModDef } from '../../src/shared/mods'
import { isRunning, sessionRow } from '../../src/shared/modSession'
import { loadMods, type LoaderInput, type LoaderResult } from '../../src/main/mods/loader'
import { ModInvocations } from '../../src/main/mods/invoke'
import { handleModProtocol } from '../../src/main/mods/protocol'
import { useModSessionStore } from '../../src/renderer/stores/modSessionStore'
import { FIXTURES, installFixture } from './fixtureMods'
import { restoreApi, stubApi } from '../fixtures'

const electron = vi.hoisted(() => ({ handle: vi.fn(), fetch: vi.fn() }))
vi.mock('electron', () => ({ protocol: { handle: electron.handle }, net: { fetch: electron.fetch } }))

let root = ''
const original = [...MODS]
const originalIds = original.map(mod => mod.id)
const def = (id: string, hooks?: readonly string[]): ModDef => ({
  id, hooks, name: id, author: 'test', version: '1.0.0', scope: 'anytime',
  defaultOn: false, blurb: 'A built-in fixture.'
})
const entry = () => import('../fixtures/builtin-main/entry')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-builtin-main-'))
  vi.clearAllMocks()
  stubApi({ mods: { noticesSeen: async () => ({ ok: true, data: undefined }) } })
})
afterEach(async () => {
  restoreApi()
  setInstalledMods(original, originalIds)
  await rm(root, { recursive: true, force: true })
})

function run(builtInMain: LoaderInput['builtInMain'], over: Partial<LoaderInput> = {}): Promise<LoaderResult> {
  return loadMods({
    modsDir: join(root, 'mods'), devFolders: [], allowUnreviewedMain: true,
    builtIn: MODS.map(mod => mod.id), builtInMain,
    coreVersion: '0.1.0', gameVersion: '0.7.0', safeStart: null,
    log: () => {}, warn: () => {}, ...over
  })
}

/** The real protocol handler, with only Electron's registration and file transport stood in. */
function serve(result: LoaderResult): (request: Request) => Promise<Response> {
  handleModProtocol({ served: () => result.served, routes: () => result.routes, hostNames: () => null })
  expect(electron.handle).toHaveBeenLastCalledWith('vxmod', expect.any(Function))
  return electron.handle.mock.lastCall![1]
}

/** Dispatches the same start/result handshake main's IPC channel uses. */
async function call(result: LoaderResult, id: string): Promise<unknown> {
  const invocations = new ModInvocations()
  invocations.replace(result.table, result.invokes)
  const requestId = invocations.dispatch(1, id, { kind: 'start', name: 'identity', args: ['hello'] })
  return invocations.dispatch(1, id, { kind: 'result', requestId })
}

it('loads built-ins from start, dispatches their invoke and serves their route without exposing core files', async () => {
  installMods([def('one', ['invoke']), def('no-main')])
  const result = await run({ one: entry })
  expect(sessionRow(result.table, 'one')?.status).toBe('loaded')
  expect(sessionRow(result.table, 'no-main')?.status).toBe('loaded')
  // A default-off switch does not prevent a loaded handler from answering.
  expect(await call(result, 'one')).toEqual({ id: 'one', value: 'hello' })
  const respond = serve(result)
  const response = await respond(new Request('vxmod://one/@/ping'))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('built-in pong')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  expect((await respond(new Request('vxmod://one/index.js'))).status).toBe(404)
  expect(electron.fetch).not.toHaveBeenCalled()
})

it.each([
  ['bad invoke name', () => ({ invoke: { 'Bad/name': () => 'bad' } })],
  ['non-function invoke', () => ({ invoke: { identity: 1 } })],
  ['own scheme', () => ({ protocols: [{ scheme: 'custom', route: 'ping', handle: () => 'bad' }] })],
  ['duplicate route', () => ({ protocols: [
    { route: 'ping', handle: () => 'bad' }, { route: 'ping', handle: () => 'bad' }
  ] })],
  ['bad route name', () => ({ protocols: [{ route: 'Bad/name', handle: () => 'bad' }] })],
  ['load exception', () => import('../fixtures/builtin-main/throws')]
])('fails only the offending built-in for %s, leaving its whole mod off', async (_reason, bad) => {
  installMods([def('bad', ['invoke']), def('good', ['invoke'])])
  // A valid route cannot survive another part of the same entry failing validation.
  const result = await run({ bad: async () => ({ protocols: (await entry()).protocols, ...await bad() }), good: entry })
  expect(sessionRow(result.table, 'bad')?.status).toBe('failed')
  expect(sessionRow(result.table, 'bad')?.message).toMatch(/^main entry failed:/)
  expect(isRunning(result.table, 'bad')).toBe(false)
  useModSessionStore.setState({ table: result.table })
  expect(useModSessionStore.getState().running('bad')).toBe(false)
  expect(useModSessionStore.getState().running('good')).toBe(true)
  useModSessionStore.getState().noticeAtStart({})
  expect(useModSessionStore.getState().notice?.mods.map(mod => mod.id)).toEqual(['bad'])
  useModSessionStore.getState().dismissNotice()
  useModSessionStore.getState().noticeAtStart({ bad: '1.0.0' })
  expect(useModSessionStore.getState().notice).toBeNull()
  expect(result.invokes.has('bad')).toBe(false)
  expect(result.routes.has('bad')).toBe(false)
  await expect(call(result, 'bad')).rejects.toMatchObject({ code: 'MOD_INVOKE_NOT_LOADED' })
  expect((await serve(result)(new Request('vxmod://bad/@/ping'))).status).toBe(404)
  expect(await call(result, 'good')).toEqual({ id: 'good', value: 'hello' })
})

it('refuses an undeclared invoke through the same declaration check as installed main.js', async () => {
  installMods([def('undeclared')])
  const result = await run({ undeclared: entry })
  expect(sessionRow(result.table, 'undeclared')?.status).toBe('failed')
  expect(sessionRow(result.table, 'undeclared')?.message).toContain('`invoke`')
  expect(result.invokes.has('undeclared')).toBe(false)
  expect(result.routes.has('undeclared')).toBe(false)
})

it('refuses unknown table ids without importing them or affecting known entries', async () => {
  installMods([def('known', ['invoke'])])
  const unknown = vi.fn(entry)
  const result = await run({ unknown, known: entry })
  expect(unknown).not.toHaveBeenCalled()
  expect(result.table.mods.find(mod => mod.id === 'unknown')).toMatchObject({ status: 'refused', def: null })
  expect(result.invokes.has('unknown')).toBe(false)
  expect(await call(result, 'known')).toEqual({ id: 'known', value: 'hello' })
})

it('keeps handlers and routes in their owning id, including result claims', async () => {
  installMods([def('one', ['invoke']), def('two')])
  const result = await run({ one: entry })
  await expect(call(result, 'two')).rejects.toMatchObject({ code: 'MOD_INVOKE_UNKNOWN' })
  const invocations = new ModInvocations()
  invocations.replace(result.table, result.invokes)
  const requestId = invocations.dispatch(1, 'one', { kind: 'start', name: 'identity', args: [] })
  await expect(invocations.dispatch(1, 'two', { kind: 'result', requestId })).rejects
    .toMatchObject({ code: 'MOD_INVOKE_UNKNOWN' })
  expect(await invocations.dispatch(1, 'one', { kind: 'result', requestId })).toMatchObject({ id: 'one' })
  expect((await serve(result)(new Request('vxmod://two/@/ping'))).status).toBe(404)
})

it.each(['hello-mod', 'another-folder'])('cannot replace a built-in entry through an installed copy or dev folder %s', async folderName => {
  installMods([def('hello-mod', ['invoke'])])
  installFixture(root, 'hello-mod')
  const dev = join(root, 'dev', folderName)
  cpSync(join(FIXTURES, 'hello-mod'), dev, { recursive: true })
  const requireMain = vi.fn(() => ({ invoke: { identity: () => 'replacement' } }))
  const result = await run({ 'hello-mod': entry }, { devFolders: [dev], requireMain })
  const refused = result.table.mods.filter(mod => mod.def === null)
  expect(refused).toHaveLength(2)
  expect(refused.map(mod => [mod.dev, mod.status, mod.message])).toEqual([
    [false, 'refused', 'already part of this build'], [true, 'refused', 'already part of this build']
  ])
  expect(requireMain).not.toHaveBeenCalled()
  expect(sessionRow(result.table, 'hello-mod')?.status).toBe('loaded')
  expect(await call(result, 'hello-mod')).toEqual({ id: 'hello-mod', value: 'hello' })
  expect(await (await serve(result)(new Request('vxmod://hello-mod/@/ping'))).text()).toBe('built-in pong')
})

it('does not import built-in entries in safe start', async () => {
  installMods([def('one', ['invoke'])])
  const load = vi.fn(entry)
  const result = await run({ one: load }, { safeStart: 'flag' })
  expect(load).not.toHaveBeenCalled()
  expect(result.invokes.size).toBe(0)
  expect(result.routes.size).toBe(0)
  expect(result.served.get('one')?.loaded).toBe(false)
})
