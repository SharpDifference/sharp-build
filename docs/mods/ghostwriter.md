# Ghostwriter

An independent, anytime mod, off by default, for the desktop app only. It writes every scene call
in two: a **writer**, a model the player picks for its storytelling, drafts the scene as plain
prose, and a **converter** turns that draft into the JSON the game plays. The writer never has to
return JSON, so any model a chat completions endpoint serves can write the scenes.

## What the player sets up

Ghostwriter's page on the Mods screen, shown while the mod is on, holds both endpoints. Each field
is written when it is left, as Settings' Advanced tab writes its own, and a value that cannot be
kept stays in its box with the reason under it.

- **Writer**: an endpoint URL, an API key, a model id, a reasoning effort, a reply cap, and the
  four samplers the game already sends a custom endpoint (temperature, top_p, top_k and
  repetition penalty).
- **Converter**: an endpoint URL, an API key, a model id, a reasoning effort and a reply cap. A
  blank URL leaves conversion to the model in Settings, on the game's own provider, key and
  settings, the solo scene still routed to the secondary model where Settings says so.

Each endpoint has a Test connection, and its model list is asked for as its URL or key is left.
The keys are encrypted at rest as the game's own are, never reach the window, and are each kept
only for the origin they were typed for, so moving a URL to another host, or emptying it, drops
its key. Until the writer has a URL and a model, the mod changes
nothing.

## What it reaches

Only scene calls: the opening, a continuation, the closing and the solo scene. Texting, the slot
opening, graduation posts, the ledgers, both classifiers and character generation are sent as
the game sends them.

## How a scene call is written

1. The window tags the call, and main's request sender for the mod takes it once Prompt Studio's
   preset, where one is in force, has been laid over it.
2. The writer is sent the request without its reply rules and with no schema, told to write
   prose alone: narration as paragraphs, each line of dialogue on its own line under the
   speaker's first name, and nothing about JSON, actions, sprites, CGs, backgrounds, the summary
   or the end of the scene. Everything else the game sends — persona, setting, the reader, the
   cast, the lorebook, the story so far, the turn's instructions — reaches it as built. A
   preset's samplers are laid over the writer's own for that call.
3. The converter is sent the whole request, reply rules and schema included, with the draft after
   it. It keeps the draft's words, splits them into lines, gives each its speaker and adds the
   stage directions; it edits lightly, and only where the draft contradicts the game's state. It
   decides whether the scene ends and writes the summary itself.
4. The converter's reply streams to the window and is sanitized there exactly as any scene
   reply is. Nothing shows while the writer drafts, so a turn takes longer.

A failure of either call reaches the player as any failed scene call does, on the same modal
with the same Retry and Edit prompt, the error naming the Story writer or the Converter where
the call went to the mod's own endpoint. Main keeps the last draft while its conversion has
failed, so a retry of exactly the same request converts it again rather than paying for a new
one; a conversion that lands, a change on the page, or any other request drafts afresh.

## Where the code is

- `src/shared/ghostwriter.ts`: the page's view of the settings, the calls main answers, and when
  each stage is ready.
- `src/shared/ghostwriterPrompt.ts`: the writer's and the converter's requests, built from the
  scene request.
- `src/main/services/ghostwriterService.ts`: the settings file, the request sender and the draft
  kept for a retry.
- `src/main/modEntries/ghostwriter.ts`: the main entry, registering the sender and answering the
  page.
- `src/renderer/modEntries/ghostwriter.ts`: the scene-call tag and the Mods screen page.
- `src/renderer/views/GhostwriterPage.tsx`: the page.

The core pieces it stands on are general: `completeText` in `src/shared/llm/cloudLlm.ts` sends a
call with no schema, and `registerRequestSender` in `src/main/services/finalRequest.ts` lets one
mod send a tagged call in the game's place.
