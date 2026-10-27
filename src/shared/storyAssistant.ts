/** The Story Assistant mod's id. */
export const STORY_ASSISTANT = 'story-assistant'

/** The most characters a question to the assistant takes. */
export const ASSISTANT_QUESTION_LIMIT = 400

/** The most ways forward one reply offers; more are dropped. */
export const ASSISTANT_SUGGESTIONS_MAX = 4

/** The most characters one suggestion's action keeps, which is what the box it fills takes. */
export const ASSISTANT_ACTION_LIMIT = 600

/** One way forward: a few words naming it, and the turn it would send. */
export interface AssistantSuggestion {
  label: string
  action: string
}

/** What the assistant says about the scene, and the ways forward it offers. */
export interface StoryAssistantReply {
  commentary: string
  suggestions: AssistantSuggestion[]
}

/** A trimmed string, or '' for anything that is not one. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The reply as the panel shows it: blank and malformed suggestions dropped, repeats folded, the
 * rest capped; null when nothing is left to show.
 */
export function storyAssistantReplyOf(raw: unknown): StoryAssistantReply | null {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const commentary = textOf(record.commentary)
  const seen = new Set<string>()
  const suggestions: AssistantSuggestion[] = []
  for (const item of Array.isArray(record.suggestions) ? record.suggestions : []) {
    const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const action = textOf(entry.action).slice(0, ASSISTANT_ACTION_LIMIT)
    if (!action || seen.has(action)) continue
    seen.add(action)
    suggestions.push({ label: textOf(entry.label) || action, action })
    if (suggestions.length === ASSISTANT_SUGGESTIONS_MAX) break
  }
  if (!commentary && suggestions.length === 0) return null
  return { commentary, suggestions }
}
