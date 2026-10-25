import type { TextBlockId, TextEdits } from './types'

/** The edited text for a block where a non-blank string is stored for it, else the fallback. */
export function blockText<Id extends TextBlockId>(
  edits: TextEdits<TextBlockId> | undefined,
  id: Id,
  fallback: string
): string {
  const edit: unknown = edits?.[id]
  return typeof edit === 'string' && edit.trim() !== '' ? edit : fallback
}
