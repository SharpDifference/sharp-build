import { sharedModOn } from './modRules'
import type { PromptEdit } from './imagePrompt'
import type { Character } from './types'

/**
 * What mods add to a sprite's or a CG's prompt draft, in either process: the editor's regenerate
 * draft in the renderer and every render in main are built by the same `imagePrompt` functions,
 * so a mod registers here, from its shared entry, and both see it.
 */

/** Which picture a draft is for: a dressed sprite, a nude one, or her CGs. */
export type ImagePromptKind = 'sprite' | 'nude' | 'cg'

/** The two groups a mod may change. Her own negatives are added after every mod's. */
export interface ImagePromptParts {
  appearance: string[]
  negative: string[]
}

export interface ImagePromptDraft {
  /** The draft's appearance and negatives with the mod's tags in them; asked only while it is on. */
  draft: (parts: ImagePromptParts, ctx: { character: Character; kind: ImagePromptKind }) => ImagePromptParts
  /**
   * What a regenerate reopens on, from what its button last sent (`kept`) and the draft it would
   * open with otherwise, so a remembered edit carries the mod's tags as they are now. Asked
   * whether or not the mod is on (`on`), so one that is off can take its own tags back out.
   */
  regen?: (kept: PromptEdit, draft: PromptEdit, on: boolean) => PromptEdit
}

const drafts = new Map<string, ImagePromptDraft>()

/** A mod's additions to sprite and CG drafts. Registering again replaces its own. */
export function registerImagePromptDraft(modId: string, draft: ImagePromptDraft): void {
  drafts.set(modId, draft)
}

/** The registered drafts in mod id order, the order every hook asks in, whatever order they loaded. */
function inIdOrder(): [string, ImagePromptDraft][] {
  return [...drafts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

/** A draft's groups through each mod that is on, in mod id order. */
export function draftedParts(
  parts: ImagePromptParts,
  ctx: { character: Character; kind: ImagePromptKind }
): ImagePromptParts {
  let drafted = parts
  for (const [modId, draft] of inIdOrder()) {
    if (sharedModOn(modId)) drafted = draft.draft(drafted, ctx)
  }
  return drafted
}

/** A regenerate's remembered edit with each mod's tags as they are now; see {@link ImagePromptDraft.regen}. */
export function regenDrafted(kept: PromptEdit, draft: PromptEdit): PromptEdit {
  let next = kept
  for (const [modId, entry] of inIdOrder()) {
    if (entry.regen) next = entry.regen(next, draft, sharedModOn(modId))
  }
  return next
}
