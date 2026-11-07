import { createHash } from 'crypto'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { modDataPath, readJsonFile, registerRequestSender, writeAtomicJson } from '@vx/modkit/main'
import { appError, messageOf } from '@shared/errors'
import { endpointProblem, sameEndpointHost } from '@shared/endpoint'
import {
  converterOwnEndpoint,
  converterProblem,
  GHOSTWRITER_MOD,
  writerReady,
  type GhostwriterEndpointView,
  type GhostwriterPatch,
  type GhostwriterStage,
  type GhostwriterView
} from '@shared/ghostwriter'
import { converterRequestOf, converterTextOfTag, writerRequestOf } from '@shared/ghostwriterPrompt'
import { completeStructured, completeText } from '@shared/llm/cloudLlm'
import { listModels } from '@shared/llm/endpointProbe'
import { readSettings } from '@shared/llm/settingsPort'
import { THINKING_LEVELS, type ThinkingLevel } from '@shared/providers'
import { SAMPLING_FIELDS, samplingOf, type SamplingKey } from '@shared/settingsRules'
import type { Settings, StructuredRequest } from '@shared/types'
import { decryptSecret, encryptSecret } from './secrets'

/**
 * Ghostwriter's own endpoints and the request sender that splits a scene call in two: a writer's
 * prose draft, then a converter's JSON. The settings live in the mod's data folder.
 */

const CONFIG_SCHEMA_VERSION = 1
const MAX_URL_LENGTH = 2048
const MAX_MODEL_LENGTH = 256
const MAX_KEY_LENGTH = 4096
const UNREADABLE_MESSAGE =
  "Ghostwriter's settings could not be read. Set it up again on its page in Mods, or switch it off."
const UNWRITABLE = { code: 'GHOSTWRITER_CONFIG_UNWRITABLE', message: "Could not save Ghostwriter's settings." }

type Sampling = Partial<Record<SamplingKey, number>>

/** One stage as held in memory, its key decrypted. */
interface Stage {
  url: string
  model: string
  reasoningEffort?: ThinkingLevel
  maxOutputTokens?: number
  key: string
}

/** Both stages as held in memory. */
interface Config {
  writer: Stage & { sampling: Sampling }
  converter: Stage
}

/** One stage as the file keeps it, its key as the keyring allows. */
interface StoredStage {
  url: string
  model: string
  reasoningEffort?: ThinkingLevel
  maxOutputTokens?: number
  key?: { enc?: string; plain?: string }
  sampling?: Sampling
}

/** A blank config: nothing set up. */
function emptyConfig(): Config {
  return {
    writer: { url: '', model: '', key: '', sampling: {} },
    converter: { url: '', model: '', key: '' }
  }
}

/** The config file's path. */
function configPath(): string {
  return join(modDataPath(GHOSTWRITER_MOD), 'config.json')
}

/** Whether the value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether the value is a thinking level. */
function isLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel)
}

/** Whether the number is a sendable reply cap: a positive whole number. */
function isCap(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** Whether the value is a number the sampler accepts; the game's own bounds decide. */
function isSamplerValue(key: SamplingKey, value: unknown): value is number {
  return typeof value === 'number' && Object.keys(samplingOf({ apiProvider: 'openai', [key]: value })).length > 0
}

/** Reads one stored stage, dropping a bad optional value with a warning; null where it is no stage at all. */
function stageOf(raw: unknown, name: string): (Stage & { sampling: Sampling }) | null {
  if (raw === undefined) return emptyConfig().writer
  if (!isRecord(raw) || typeof raw.url !== 'string' || typeof raw.model !== 'string') return null
  const stage: Stage & { sampling: Sampling } = { url: raw.url, model: raw.model, key: '', sampling: {} }
  if (raw.reasoningEffort !== undefined) {
    if (isLevel(raw.reasoningEffort)) stage.reasoningEffort = raw.reasoningEffort
    else console.warn(`[ghostwriter] ${name}: the thinking level was not used.`)
  }
  if (raw.maxOutputTokens !== undefined) {
    if (isCap(raw.maxOutputTokens)) stage.maxOutputTokens = raw.maxOutputTokens
    else console.warn(`[ghostwriter] ${name}: the reply cap was not used.`)
  }
  if (raw.key !== undefined) {
    const key = raw.key
    if (isRecord(key) && (key.enc === undefined || typeof key.enc === 'string') &&
        (key.plain === undefined || typeof key.plain === 'string')) {
      stage.key = decryptSecret(
        key.enc as string | undefined,
        key.plain as string | undefined,
        `Ghostwriter's ${name} key`
      )
    } else console.warn(`[ghostwriter] ${name}: the key was not used.`)
  }
  if (raw.sampling !== undefined) {
    if (isRecord(raw.sampling)) {
      for (const field of SAMPLING_FIELDS) {
        const value = raw.sampling[field.key]
        if (value === undefined) continue
        if (isSamplerValue(field.key, value)) stage.sampling[field.key] = value
        else console.warn(`[ghostwriter] ${name}: ${field.label} was not used.`)
      }
    } else console.warn(`[ghostwriter] ${name}: the sampler values were not used.`)
  }
  return stage
}

/** The config a parsed file holds, or null where it is no config of this version. */
function configOf(parsed: unknown): Config | null {
  if (!isRecord(parsed) || parsed.schemaVersion !== CONFIG_SCHEMA_VERSION) return null
  const writer = stageOf(parsed.writer, 'writer')
  const second = stageOf(parsed.converter, 'converter')
  if (!writer || !second) return null
  const { sampling: _unused, ...converter } = second
  return { writer, converter }
}

/** The config as held in memory once read, or null until then. */
let loaded: Config | null = null

/** The config, from memory or the file; null (with a warning) where the file cannot be read or is no config. */
async function readConfig(): Promise<Config | null> {
  if (loaded) return loaded
  try {
    const failure = { code: 'GHOSTWRITER_CONFIG_UNREADABLE', message: UNREADABLE_MESSAGE }
    const read = await readJsonFile<null>(configPath(), {
      malformed: failure,
      unreadable: failure,
      onMissing: () => null
    })
    if (read.kind === 'missing') return (loaded = emptyConfig())
    const config = configOf(read.parsed)
    if (!config) {
      console.warn('[ghostwriter] config.json is not a Ghostwriter config; it is not used.')
      return null
    }
    return (loaded = config)
  } catch (err) {
    console.warn('[ghostwriter] config.json could not be read:', messageOf(err))
    return null
  }
}

/** The config for the sender: it, or the unreadable-file error. */
async function configOrThrow(): Promise<Config> {
  const config = await readConfig()
  if (!config) throw appError('GHOSTWRITER_CONFIG_UNREADABLE', UNREADABLE_MESSAGE)
  return config
}

/** One stage as the page sees it. */
function endpointViewOf(stage: Stage): GhostwriterEndpointView {
  const view: GhostwriterEndpointView = { url: stage.url, model: stage.model, keySet: stage.key !== '' }
  if (stage.reasoningEffort) view.reasoningEffort = stage.reasoningEffort
  if (stage.maxOutputTokens) view.maxOutputTokens = stage.maxOutputTokens
  return view
}

/** Both stages as the page sees them: no key, only whether one is set. */
function viewOf(config: Config): GhostwriterView {
  return {
    writer: { ...endpointViewOf(config.writer), sampling: { ...config.writer.sampling } },
    converter: endpointViewOf(config.converter)
  }
}

/** What the page sees of Ghostwriter's settings; blank where the file is missing or unreadable. */
export async function readView(): Promise<GhostwriterView> {
  return viewOf((await readConfig()) ?? emptyConfig())
}

/** One stage in the file's shape, its key encrypted. */
function storedStageOf(stage: Stage, sampling?: Sampling): StoredStage {
  const stored: StoredStage = { url: stage.url, model: stage.model }
  if (stage.reasoningEffort) stored.reasoningEffort = stage.reasoningEffort
  if (stage.maxOutputTokens) stored.maxOutputTokens = stage.maxOutputTokens
  const key = encryptSecret(stage.key)
  if (key.enc || key.plain) stored.key = key
  if (sampling) stored.sampling = sampling
  return stored
}

/** The patch's text field, trimmed, or undefined where it is absent; anything but a short string is refused. */
function textOf(patch: Record<string, unknown>, field: string, limit: number): string | undefined {
  const value = patch[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length > limit) {
    throw appError('GHOSTWRITER_PATCH_INVALID', `Ghostwriter's ${field} must be text of at most ${limit} characters.`)
  }
  return value.trim()
}

/** The config with a window's patch applied, after checking every part of it; the given config is left as it is. */
function applyPatch(config: Config, input: unknown): Config {
  if (!isRecord(input)) throw appError('GHOSTWRITER_PATCH_INVALID', 'Ghostwriter was sent a change it could not read.')
  const allowed = ['stage', 'url', 'model', 'key', 'reasoningEffort', 'maxOutputTokens', 'sampling']
  for (const name of Object.keys(input)) {
    if (!allowed.includes(name)) throw appError('GHOSTWRITER_PATCH_INVALID', `Ghostwriter has no setting called ${name}.`)
  }
  if (input.stage !== 'writer' && input.stage !== 'converter') {
    throw appError('GHOSTWRITER_PATCH_INVALID', 'Ghostwriter has no such stage.')
  }
  const stage: GhostwriterStage = input.stage
  const url = textOf(input, 'url', MAX_URL_LENGTH)
  const model = textOf(input, 'model', MAX_MODEL_LENGTH)
  if (input.key !== undefined && (typeof input.key !== 'string' || input.key.length > MAX_KEY_LENGTH)) {
    throw appError('GHOSTWRITER_PATCH_INVALID', "Ghostwriter's key must be text.")
  }
  const effort = input.reasoningEffort
  if (effort !== undefined && effort !== null && !isLevel(effort)) {
    throw appError('GHOSTWRITER_PATCH_INVALID', 'That thinking level is not one Ghostwriter knows.')
  }
  const cap = input.maxOutputTokens
  if (cap !== undefined && cap !== null && !isCap(cap)) {
    throw appError('GHOSTWRITER_PATCH_INVALID', 'Max output tokens must be a whole number above 0.')
  }
  const sampling = input.sampling
  if (sampling !== undefined) {
    if (stage !== 'writer' || !isRecord(sampling)) {
      throw appError('GHOSTWRITER_PATCH_INVALID', 'Only the writer takes sampler values.')
    }
    for (const [name, value] of Object.entries(sampling)) {
      const field = SAMPLING_FIELDS.find((f) => f.key === name)
      if (!field) throw appError('GHOSTWRITER_PATCH_INVALID', `Ghostwriter has no sampler called ${name}.`)
      if (value !== null && !isSamplerValue(field.key, value)) {
        throw appError('GHOSTWRITER_PATCH_INVALID', `${field.label} is outside the range it takes.`)
      }
    }
  }

  const next: Config = {
    writer: { ...config.writer, sampling: { ...config.writer.sampling } },
    converter: { ...config.converter }
  }
  const target: Stage = next[stage]
  if (url !== undefined) {
    // A key typed for one origin never follows the player to another; one typed before any URL
    // belongs to the first URL written.
    if (target.url !== '' && !sameEndpointHost(target.url, url) && input.key === undefined) target.key = ''
    target.url = url
  }
  if (model !== undefined) target.model = model
  if (typeof input.key === 'string') target.key = input.key.trim()
  if (effort === null) delete target.reasoningEffort
  else if (effort !== undefined) target.reasoningEffort = effort
  if (cap === null) delete target.maxOutputTokens
  else if (cap !== undefined) target.maxOutputTokens = cap
  if (sampling !== undefined) {
    for (const [name, value] of Object.entries(sampling as Record<string, number | null>)) {
      const key = name as SamplingKey
      if (value === null) delete next.writer.sampling[key]
      else next.writer.sampling[key] = value
    }
  }
  return next
}

/** The draft kept from the last writer call, and the hash of what shaped that call. */
let cachedDraft: { key: string; draft: string } | null = null

/** The config writes so far: each waits for them, so it starts from what the last one wrote. */
let lastWrite: Promise<unknown> = Promise.resolve()

/** Changes one stage's settings and returns what the page now sees; the file is replaced whole. */
export function writePatch(patch: GhostwriterPatch): Promise<GhostwriterView> {
  const run = async (): Promise<GhostwriterView> => {
    const next = applyPatch((await readConfig()) ?? emptyConfig(), patch)
    await mkdir(modDataPath(GHOSTWRITER_MOD), { recursive: true })
    await writeAtomicJson(
      configPath(),
      {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        writer: storedStageOf(next.writer, next.writer.sampling),
        converter: storedStageOf(next.converter)
      },
      UNWRITABLE
    )
    loaded = next
    cachedDraft = null
    return viewOf(next)
  }
  const result = lastWrite.then(run, run)
  lastWrite = result.catch(() => {})
  return result
}

/** The game's stored settings with one stage's endpoint laid over them, as a custom endpoint call. */
async function candidateOf(stage: Stage, sampling: Sampling): Promise<Settings> {
  const candidate: Settings = {
    ...(await readSettings()),
    apiProvider: 'openai',
    endpointUrl: stage.url,
    endpointModel: stage.model,
    endpointApiKey: stage.key || undefined,
    endpointSecondaryModel: undefined,
    reasoningEffort: stage.reasoningEffort,
    maxOutputTokens: stage.maxOutputTokens,
    endpointServiceTier: undefined
  }
  for (const field of SAMPLING_FIELDS) candidate[field.key] = sampling[field.key]
  return candidate
}

/** A hash of everything that shapes one writer call, so a retry can tell its draft is still good. */
function writerCallKey(stage: Stage, wireSampling: Record<string, number>, request: StructuredRequest): string {
  const hash = createHash('sha256')
  const sampler = Object.keys(wireSampling).sort().map((name) => [name, wireSampling[name]])
  const parts = [
    stage.url, stage.model, stage.reasoningEffort ?? '', String(stage.maxOutputTokens ?? ''),
    JSON.stringify(sampler), request.system, request.user, JSON.stringify(request.images ?? [])
  ]
  for (const part of parts) hash.update(`${part.length}:${part}`)
  return hash.digest('hex')
}

/** Throws the cancellation the game's own calls throw, where the job has been cancelled. */
function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw appError('CANCELLED', 'The job was cancelled.')
}

/**
 * Sends a tagged scene call as two: the writer's prose draft, then the converter's JSON. Null
 * where the writer is not set up, so the call goes as the game built it.
 */
async function sendScene(
  request: StructuredRequest,
  ctx: { tag: unknown; signal?: AbortSignal; onDelta?: (delta: string) => void; sampling: Record<string, number> }
): Promise<{ reply: unknown } | null> {
  const config = await configOrThrow()
  if (!writerReady(config.writer)) {
    console.log('[ghostwriter] the writer is not set up; the scene goes as the game built it.')
    return null
  }
  const problem = converterProblem(config.converter)
  if (problem) throw appError('LLM_ENDPOINT_INVALID', `${problem} Fix it on Ghostwriter's page in Mods.`)

  const writerRequest = writerRequestOf(request)
  const writerSettings = await candidateOf(config.writer, config.writer.sampling)
  const wireSampling = { ...samplingOf(writerSettings), ...ctx.sampling }
  const key = writerCallKey(config.writer, wireSampling, writerRequest)

  let draft: string
  if (cachedDraft?.key === key) {
    draft = cachedDraft.draft
    console.log(`[ghostwriter] writer: reusing the earlier draft (${draft.length} chars)`)
  } else {
    draft = await completeText(writerRequest, ctx.signal, () => {}, writerSettings, ctx.sampling, 'Story writer')
    cachedDraft = { key, draft }
    console.log(`[ghostwriter] writer: draft of ${draft.length} chars`)
  }
  throwIfCancelled(ctx.signal)

  const own = converterOwnEndpoint(config.converter)
  const converterSettings = own ? await candidateOf(config.converter, {}) : undefined
  const converterText = converterTextOfTag(ctx.tag)
  console.log(
    `[ghostwriter] converter: ${own ? 'its own endpoint' : "the game's model"}, sent ${
      converterText ? 'the reply rules, the stage, the story and the turn' : 'the whole request'
    }`
  )
  const reply = await completeStructured<unknown>(
    converterRequestOf(request, draft, converterText),
    ctx.signal,
    ctx.onDelta,
    converterSettings,
    undefined,
    own ? 'Converter' : undefined
  )
  cachedDraft = null
  return { reply }
}

/** Registers the request sender for tagged scene calls; the returned function removes it. */
export function registerGhostwriterSender(): () => void {
  return registerRequestSender(GHOSTWRITER_MOD, (request, ctx) => sendScene(request, ctx))
}

/** Sends one tiny call on a stage's endpoint; the `AppError` it throws is the answer the page reports. */
export async function testEndpoint(stage: GhostwriterStage): Promise<void> {
  const config = await configOrThrow()
  if (stage === 'writer') {
    const problem = endpointProblem(config.writer.url)
    if (problem) throw appError('LLM_ENDPOINT_INVALID', problem)
    if (!writerReady(config.writer)) throw appError('GHOSTWRITER_NOT_SET_UP', "Enter the writer's model ID.")
    await completeText(
      { system: 'Answer with one word.', user: 'Ping.', schema: { name: 'connection_test', schema: {} } },
      undefined,
      undefined,
      await candidateOf(config.writer, config.writer.sampling),
      undefined,
      'Story writer'
    )
    return
  }
  if (!converterOwnEndpoint(config.converter)) {
    throw appError('GHOSTWRITER_NOT_SET_UP', 'The converter has no endpoint of its own, so there is nothing to test.')
  }
  const problem = converterProblem(config.converter)
  if (problem) throw appError('LLM_ENDPOINT_INVALID', problem)
  await completeStructured<{ ok: boolean }>(
    {
      system: 'Answer with ok true.',
      user: 'Ping.',
      schema: {
        name: 'connection_test',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: { ok: { type: 'boolean' } }
        }
      }
    },
    undefined,
    undefined,
    await candidateOf(config.converter, {}),
    undefined,
    'Converter'
  )
}

/** The model ids a stage's endpoint lists, on its own key; none where it has no URL. */
export async function listStageModels(stage: GhostwriterStage): Promise<string[]> {
  const config = (await readConfig()) ?? emptyConfig()
  const one = stage === 'writer' ? config.writer : config.converter
  if (one.url.trim() === '') return []
  return listModels({ endpointUrl: one.url, apiKey: one.key || undefined })
}
