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

1. The window tags the call with the converter's text, cut from the request before any preset is
   laid over it, and main's request sender for the mod takes the call once Prompt Studio's
   preset, where one is in force, has been laid over it.
2. The writer is sent the request without its reply rules and with no schema, told to write
   prose alone: narration as paragraphs, each line of dialogue on its own line under the
   speaker's first name, the reader's under `You:`, and nothing about JSON, actions, sprites,
   CGs, backgrounds, the summary or the end of the scene. It may add stage notes, each on a line of its own starting with
   `Action:`, where somebody arrives or leaves, the scene moves or somebody changes clothes. Of
   the reply rules it keeps only the places the game can show, so it sets its scenes and notes
   in them. Everything else the game sends — persona, setting, the reader, the cast, the
   lorebook, the story so far, the turn's instructions — reaches it as built. A preset's
   samplers are laid over the writer's own for that call.
3. The converter is sent only what the reply needs: in place of the persona, a few lines making
   it RITA's script editor, who keeps her voice in any line it words itself, the reply rules and schema, the cast's character keys with each girl's outfit
   suffixes and room and the reader's room, all read off the schema, the NOW block, the story
   and scene so far, the turn's instructions and whatever the mods added beside them, such as a
   group photo to fill in, with the draft after it. The setting, the reader, the cast, the
   class, the lorebook, the mods' notes and the preset's blocks are the writer's alone, so when
   to wear one of her own outfits is the writer's to say in a stage note, and the converter is
   not offered Prompt Studio's `vars`: scene replies change no variables, which the mod's page
   says while Prompt Studio is on. It carries out each stage note in the stage directions and
   never writes one as a line, reports what the reader or anybody outside the cast says in
   narration instead of quoting it, the reader's in the second person, keeps the rest of the
   draft's words, splits them into lines, gives each its speaker and adds the stage directions,
   changing nothing that happens. A scene too big for the schema to list its stage directions
   gives it no outfit suffixes. It decides whether the scene ends and writes the summary itself,
   and where the reply carries Mini Games' `minigame` or `minigameInvite` field, it is told to fill
   it from what happens in the draft: a game is offered, agreed to or turned down only where the
   draft says so.
   Where the reply rules or the turn cannot be found in the request, as after the player edits a
   failed prompt, it is sent the whole request instead, preset and all.
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
  scene request, and the converter's text the window cuts for the tag.
- `src/main/services/ghostwriterService.ts`: the settings file, the request sender and the draft
  kept for a retry.
- `src/main/modEntries/ghostwriter.ts`: the main entry, registering the sender and answering the
  page.
- `src/renderer/modEntries/ghostwriter.ts`: the scene-call tag, carrying the converter's text,
  and the Mods screen page.
- `src/renderer/views/GhostwriterPage.tsx`: the page.

The core pieces it stands on are general: `completeText` in `src/shared/llm/cloudLlm.ts` sends a
call with no schema, and `registerRequestSender` in `src/main/services/finalRequest.ts` lets one
mod send a tagged call in the game's place.
