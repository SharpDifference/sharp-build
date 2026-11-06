import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { invoke } from '@vx/modkit/renderer'
import { endpointProblem } from '@shared/endpoint'
import {
  GHOSTWRITER_CALLS,
  GHOSTWRITER_MOD,
  converterOwnEndpoint,
  converterProblem,
  writerReady,
  type GhostwriterEndpointView,
  type GhostwriterPatch,
  type GhostwriterStage,
  type GhostwriterView
} from '@shared/ghostwriter'
import { MAX_OUTPUT_TOKENS } from '@shared/llm/adapter'
import { THINKING_LEVELS, THINKING_LEVEL_LABELS, type ThinkingLevel } from '@shared/providers'
import {
  SAMPLING_FIELDS,
  maxOutputTokensProblem,
  parseMaxOutputTokens,
  parseSampling,
  samplingProblem,
  type SamplingKey
} from '@shared/settingsRules'
import type { Result } from '@shared/types'
import { ComboField } from '../components/ComboField'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { isWebBuild } from '../platform'
import { gestures, quietLift, quietPress } from './motion'
import { testWordOf, type TestState } from './useEndpointProbe'
import '../vu_styles/Ghostwriter.css'

const URL_HINT = 'The base URL of a chat completions endpoint (usually ends in /v1)'
const EFFORT_HINT =
  'Sent with every call. Some servers reject the field outright, and only some models accept Minimal.'

/** What a stage's boxes hold: its endpoint's fields as typed, the key box emptied once it is sent. */
interface StageDraft {
  url: string
  model: string
  key: string
  effort: ThinkingLevel
  cap: string
  sampling: Record<SamplingKey, string>
}

type Drafts = Record<GhostwriterStage, StageDraft>

/** A stored number as the text a field would show for it, or blank where it is absent. */
function textOf(value: number | undefined): string {
  return value !== undefined ? String(value) : ''
}

/** What one stage's boxes show for the stored endpoint; only the writer has sampling values. */
function draftOf(view: GhostwriterEndpointView, stage: GhostwriterStage, writer: GhostwriterView['writer']): StageDraft {
  const sampling = {} as Record<SamplingKey, string>
  for (const field of SAMPLING_FIELDS) {
    sampling[field.key] = stage === 'writer' ? textOf(writer.sampling[field.key]) : ''
  }
  return {
    url: view.url,
    model: view.model,
    key: '',
    effort: view.reasoningEffort ?? 'minimal',
    cap: textOf(view.maxOutputTokens),
    sampling
  }
}

/** Both stages' boxes for a stored view. */
function draftsOf(view: GhostwriterView): Drafts {
  return {
    writer: draftOf(view.writer, 'writer', view.writer),
    converter: draftOf(view.converter, 'converter', view.writer)
  }
}

/** Whether a URL box may be written: blank is none, anything else must be sendable to. */
function urlWritable(stage: GhostwriterStage, url: string): boolean {
  return url.trim() === '' || endpointProblem(url, stage === 'converter' ? 'converter URL' : undefined) === null
}

/** The first thing wrong with a stage's boxes as they are typed, or null. */
function problemOf(stage: GhostwriterStage, draft: StageDraft): string | null {
  const own =
    stage === 'writer'
      ? draft.url.trim() === ''
        ? null
        : endpointProblem(draft.url)
      : converterProblem(draft)
  return (
    own ??
    maxOutputTokensProblem(draft.cap) ??
    (stage === 'writer'
      ? (SAMPLING_FIELDS.map((field) => samplingProblem(field.key, draft.sampling[field.key])).find(
          (problem) => problem !== null
        ) ?? null)
      : null)
  )
}

/** The mod's page on the Mods screen: both stages' endpoints, written as each box is left. */
export function GhostwriterPage(): JSX.Element {
  if (isWebBuild()) return <p className="vu-mods-note">Ghostwriter needs the desktop app.</p>
  return <GhostwriterForm />
}

/** The form itself, kept apart so the browser build never reaches main. */
function GhostwriterForm(): JSX.Element | null {
  const [view, setView] = useState<GhostwriterView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drafts, setDraftsState] = useState<Drafts | null>(null)
  const [models, setModels] = useState<Record<GhostwriterStage, string[]>>({ writer: [], converter: [] })
  const [tests, setTests] = useState<Record<GhostwriterStage, TestState>>({
    writer: 'idle',
    converter: 'idle'
  })
  const [popupHost, setPopupHost] = useState<HTMLElement | null>(null)

  // What main last stored, and the boxes as typed: read at the moment of a blur, which may come
  // in the same tick as the change before it.
  const stored = useRef<GhostwriterView | null>(null)
  const typed = useRef<Drafts | null>(null)
  // Writes go through one lane, so each reads the stored view the one before it left.
  const lane = useRef<Promise<unknown>>(Promise.resolve())
  const modelAsks = useRef<Record<GhostwriterStage, number>>({ writer: 0, converter: 0 })
  const mounted = useRef(true)
  const commitAll = useRef<(() => Promise<void>) | null>(null)

  /** Runs a task after every one queued before it. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = lane.current.then(task, task)
    lane.current = next.catch(() => undefined)
    return next
  }

  /** Changes one box of one stage, and forgets any test result the change has outdated. */
  function setDraft<K extends keyof StageDraft>(stage: GhostwriterStage, key: K, value: StageDraft[K]): void {
    if (!typed.current) return
    typed.current = { ...typed.current, [stage]: { ...typed.current[stage], [key]: value } }
    setDraftsState(typed.current)
    setTests((prev) => (prev[stage] === 'testing' || prev[stage] === 'idle' ? prev : { ...prev, [stage]: 'idle' }))
  }

  /** Changes one sampling box of the writer. */
  function setSampling(key: SamplingKey, value: string): void {
    if (!typed.current) return
    setDraft('writer', 'sampling', { ...typed.current.writer.sampling, [key]: value })
  }

  /** Takes main's stored view as the page's own, leaving the boxes as they are typed. */
  function adopt(next: GhostwriterView): void {
    stored.current = next
    if (mounted.current) setView(next)
  }

  /** Sends whatever of a stage's boxes differs from what is stored and can be kept. */
  function commitStage(stage: GhostwriterStage): Promise<void> {
    return enqueue(async () => {
      const current = stored.current
      const draft = typed.current?.[stage]
      if (!current || !draft) return
      const was = current[stage]
      const patch: GhostwriterPatch = { stage }
      if (draft.url !== was.url && urlWritable(stage, draft.url)) patch.url = draft.url
      if (draft.model.trim() !== was.model) patch.model = draft.model.trim()
      if (draft.key !== '') patch.key = draft.key
      if (draft.effort !== (was.reasoningEffort ?? 'minimal')) patch.reasoningEffort = draft.effort
      if (maxOutputTokensProblem(draft.cap) === null) {
        const cap = parseMaxOutputTokens(draft.cap)
        if (cap !== was.maxOutputTokens) patch.maxOutputTokens = cap ?? null
      }
      if (stage === 'writer') {
        const sampling: Partial<Record<SamplingKey, number | null>> = {}
        for (const field of SAMPLING_FIELDS) {
          if (samplingProblem(field.key, draft.sampling[field.key]) !== null) continue
          const value = parseSampling(field.key, draft.sampling[field.key])
          if (value !== current.writer.sampling[field.key]) sampling[field.key] = value ?? null
        }
        if (Object.keys(sampling).length > 0) patch.sampling = sampling
      }
      if (Object.keys(patch).length === 1) return
      const result = await invoke<GhostwriterView>(GHOSTWRITER_MOD, GHOSTWRITER_CALLS.write, [patch])
      if (result.ok) {
        adopt(result.data)
        // The key is sent once and the box emptied, unless more was typed meanwhile.
        if (patch.key !== undefined && mounted.current && typed.current?.[stage].key === patch.key) {
          setDraft(stage, 'key', '')
        }
        return
      }
      // Put every field this write carried back to what is stored.
      if (!mounted.current || !typed.current) return
      const back = draftOf(was, stage, current.writer)
      const live = typed.current[stage]
      typed.current = {
        ...typed.current,
        [stage]: {
          ...live,
          url: patch.url !== undefined ? back.url : live.url,
          model: patch.model !== undefined ? back.model : live.model,
          effort: patch.reasoningEffort !== undefined ? back.effort : live.effort,
          cap: patch.maxOutputTokens !== undefined ? back.cap : live.cap,
          sampling: { ...live.sampling, ...(patch.sampling ? pickBack(patch.sampling, back.sampling) : {}) }
        }
      }
      setDraftsState(typed.current)
    })
  }

  /** The sampling boxes a failed write carried, as their stored text. */
  function pickBack(
    sent: Partial<Record<SamplingKey, number | null>>,
    back: Record<SamplingKey, string>
  ): Partial<Record<SamplingKey, string>> {
    const out: Partial<Record<SamplingKey, string>> = {}
    for (const key of Object.keys(sent) as SamplingKey[]) out[key] = back[key]
    return out
  }

  /** Asks the stored endpoint of a stage which models it serves; a list it cannot give is none. */
  async function refreshModels(stage: GhostwriterStage): Promise<void> {
    const ask = ++modelAsks.current[stage]
    const own = stored.current?.[stage]
    if (!own || own.url.trim() === '') {
      if (mounted.current) setModels((prev) => ({ ...prev, [stage]: [] }))
      return
    }
    const result = await invoke<string[]>(GHOSTWRITER_MOD, GHOSTWRITER_CALLS.models, [stage])
    if (!mounted.current || ask !== modelAsks.current[stage]) return
    setModels((prev) => ({ ...prev, [stage]: result.ok ? result.data : [] }))
  }

  /** A URL or key box left: sent, then the endpoint asked what it serves. */
  function handleEndpointLeft(stage: GhostwriterStage): void {
    void commitStage(stage).then(() => refreshModels(stage))
  }

  /** A selected effort is written the moment it is picked. */
  function handleEffort(stage: GhostwriterStage, value: string): void {
    setDraft(stage, 'effort', value as ThinkingLevel)
    void commitStage(stage)
  }

  /** Sends one tiny request on what is stored, once the boxes are written. */
  async function runTest(stage: GhostwriterStage): Promise<void> {
    setTests((prev) => ({ ...prev, [stage]: 'testing' }))
    await commitStage(stage)
    const result: Result<unknown> = await invoke(GHOSTWRITER_MOD, GHOSTWRITER_CALLS.test, [stage])
    if (!mounted.current) return
    setTests((prev) => ({ ...prev, [stage]: result.ok ? 'ok' : { error: result.error } }))
  }

  // Fills what commits every stage still holding text it has not sent; re-filled every render.
  commitAll.current = async (): Promise<void> => {
    await commitStage('writer')
    await commitStage('converter')
  }

  // Opens on what main has stored, and asks each stage with a URL what it serves.
  useEffect(() => {
    mounted.current = true
    void invoke<GhostwriterView>(GHOSTWRITER_MOD, GHOSTWRITER_CALLS.read, []).then((result) => {
      if (!mounted.current) return
      if (!result.ok) {
        setLoadError(result.error.message)
        return
      }
      stored.current = result.data
      typed.current = draftsOf(result.data)
      setView(result.data)
      setDraftsState(typed.current)
      void refreshModels('writer')
      void refreshModels('converter')
    })
    // Whatever is still typed is sent as the page goes, a blur not being guaranteed.
    return () => {
      void commitAll.current?.()
      mounted.current = false
    }
  }, [])

  if (loadError) return <p className="vu-mods-note">{loadError}</p>
  if (!view || !drafts) return null

  /** One stage's fields, down to its Test connection row where it has one. */
  function section(stage: GhostwriterStage): JSX.Element {
    const draft = drafts![stage]
    const own = stage === 'converter' ? converterOwnEndpoint(view!.converter) : true
    const problem = problemOf(stage, draft)
    const test = tests[stage]
    const word = testWordOf(test)
    return (
      <>
        <h4 className="vu-mods-label">{stage === 'writer' ? 'Writer' : 'Converter'}</h4>
        <p className="vu-mods-option-hint">
          {stage === 'writer'
            ? "Writes every scene as plain prose. Any chat completions endpoint will do, including models that can't return JSON."
            : 'Turns the writer\'s draft into the script the game plays. Leave the URL blank to use the model in Settings.'}
        </p>
        <TextField
          id={`ghostwriter-${stage}-url`}
          label="Endpoint URL"
          hint={URL_HINT}
          value={draft.url}
          onChange={(value) => setDraft(stage, 'url', value)}
          onBlur={() => handleEndpointLeft(stage)}
        />
        <label className="vu-field" htmlFor={`ghostwriter-${stage}-key`}>
          <span className="vu-field-label">API key</span>
          <input
            id={`ghostwriter-${stage}-key`}
            className="vu-input"
            type="password"
            value={draft.key}
            onChange={(e) => setDraft(stage, 'key', e.target.value)}
            onBlur={() => handleEndpointLeft(stage)}
            placeholder={
              view![stage].keySet ? 'Leave blank to keep your saved key' : 'Optional: only if the endpoint needs one'
            }
          />
        </label>
        <ComboField
          id={`ghostwriter-${stage}-model`}
          label="Model ID"
          value={draft.model}
          onChange={(value) => setDraft(stage, 'model', value)}
          onBlur={() => void commitStage(stage)}
          options={models[stage]}
          popupHost={popupHost}
        />
        <SelectField
          id={`ghostwriter-${stage}-reasoning-effort`}
          label="Reasoning effort"
          hint={EFFORT_HINT}
          value={draft.effort}
          onChange={(value) => handleEffort(stage, value)}
          options={THINKING_LEVELS.map((level) => ({ value: level, label: THINKING_LEVEL_LABELS[level] }))}
        />
        <TextField
          id={`ghostwriter-${stage}-max-tokens`}
          label="Max output tokens"
          placeholder={String(MAX_OUTPUT_TOKENS)}
          value={draft.cap}
          onChange={(value) => setDraft(stage, 'cap', value)}
          maxLength={7}
          onBlur={() => void commitStage(stage)}
        />
        {stage === 'writer' &&
          SAMPLING_FIELDS.map((field) => (
            <TextField
              key={field.key}
              id={`ghostwriter-writer-${field.key}`}
              label={field.label}
              value={draft.sampling[field.key]}
              onChange={(value) => setSampling(field.key, value)}
              maxLength={8}
              onBlur={() => void commitStage('writer')}
            />
          ))}
        {problem && (
          <p className="vu-mods-note" data-kind="needs">
            {problem}
          </p>
        )}
        {own && (
          <div className="vu-test-row">
            <motion.button
              id={`ghostwriter-${stage}-test`}
              className="vu-btn vu-btn--quiet"
              type="button"
              disabled={test === 'testing'}
              {...gestures(test === 'testing', quietLift, quietPress)}
              onClick={() => void runTest(stage)}
            >
              Test connection
            </motion.button>
            {word && <span className="vu-btn-sub">{word}</span>}
            {typeof test === 'object' && <span className="vu-test-note">{test.error.message}</span>}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="vu-ghostwriter">
      <p className="vu-mods-note">
        {writerReady(view.writer)
          ? 'Scenes take longer with Ghostwriter on: nothing shows until the writer\'s draft is done.'
          : 'Until the writer has a URL and a model, scenes are written as usual.'}
      </p>
      {section('writer')}
      <hr className="vu-rule" />
      {section('converter')}
      <div className="vu-popups" ref={setPopupHost} />
    </div>
  )
}
