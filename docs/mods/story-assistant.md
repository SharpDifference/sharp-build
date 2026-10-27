# Story Assistant

Story Assistant is an independent `anytime` switch in Mods (`story-assistant`), off by default.
It needs no other mod.

## Playing

On the reader's turn in a cast scene — at the action box, or over a finished reply's last line
where the row there lets a turn through — the assistant reads the scene. What it makes of it
stands in a speech bubble over the dialogue box, its mark speaking from the bubble's foot, and
its ways forward stand over the bubble as a visual novel's menu: pressing one sends it as the
reader's turn, exactly as typing it into the action box would. The action box stays open beneath
for a turn of the player's own. While a read is on its way the bubble says so; a read that fails
says why in the bubble, with **Retry**, and is never sent again on its own.

None of it is offered where there is no cast scene to talk about: a solo scene, an exam, a
replay, a created scene, the orientation, the graduation epilogue, and a scene once it has
reached its ending. It stands down while a panel, a modal or a failure is over the scene, behind
a crossing and while the interface is hidden.

The rail carries a speech-bubble seat too, live on the reader's turn and dim while a reply is
still arriving or being read. It opens a panel that shows the same read: **Ask about the scene**
takes a question in place of the general read, **Ask** sends it, **Read again** asks for a fresh
read. Picking a way forward there copies its words into **Your turn**, where the player can
change them before **Send**. Whatever the panel last read — a question's answer included —
stands in the bubble and the menu once it closes.

There is one read per point of the scene. Any change to the scene — a new line, a rewind's cut, a
rewritten line, a load — retires it and cancels one still on its way. Reads live in memory only:
nothing is written to a save, and switching the mod off leaves nothing behind.

## Options

- **Pop up every turn**, on by default: the scene is read of its own accord at every decision
  point, one call each. Off, nothing is read until the panel is opened.
- **Choices per turn**: **Exactly four** (the default) asks for four ways forward and holds the
  reply to four; **As many as fit** lets the model offer one to four.

## The prompt

The mod's page on the Mods screen, drawn while the mod is on, carries both options and the
prompt every read is written from: who the assistant is and what its two fields hold. It is kept
as the box is left, and **Reset to default** puts the shipped one back; a prompt saved blank, or
identical to the shipped one, is stored as absent. The app adds two lines after it whatever it
says: how many ways forward to offer, from the option, and, under `lessNsfwText`, a line keeping
the read short of explicit sex. The JSON schema still holds the reply to its two fields.

It is kept in `data/story-assistant.json` (`{ schemaVersion, prompt? }`), read and written by
`main/services/storyAssistantService.ts`, and in the browser build's own storage under
`vu-story-assistant`, as the mod switches are. Like `data/mods.json`, it is not in the game's
backup. It is read once, as a game is entered or the Mods page opens; a read waits on it.

## What the assistant is told

The request is built by `buildStoryAssistantPrompt` from what the player has been shown and
nothing else:

- the playthrough's setting and the `READER` block;
- the date and half of the day;
- the four newest finished slots' summaries, and up to four older ones that name a girl in the
  scene by the name the reader knows her by;
- each girl still in the scene: her contact page's tag, the milestones the player has watched
  happen (dating, kissed, slept together, breakups, friendzones, her number, a block), and —
  once she has given him her number — what her contact page has open: likes and dislikes, her
  type, backstory and love life on the page's own thresholds (`contactRevealsOf`), and her
  memories under the cast-scene memory budget; her told secrets, the player's notes and the
  plans ahead with her;
- the running summary and the transcript's tail, exactly as a continuation call reads them.

It is never told an untold secret, a crush, her personality or behaviour lines, her haunts,
affection as a number or the balance. A girl whose name the reader has not learned is listed by
a label alone, and every spelling of her first, last and whole name anywhere in the request is
replaced by that label, sparing a name a named girl in the scene also answers to.

A read is taken only at a decision point, and there every delivered line has been read, so the
running summary covers nothing the player has not seen.

## Cost and failures

Each read is one structured call on the channel `llm:completeStoryAssistant`, on the main writer
model at the player's own effort; it is not routed to the secondary model and no preset is
applied. With **Pop up every turn** on that is one call per turn of every cast scene. Asking
again, the scene moving on and leaving the game cancel the call in flight; closing the panel does
not, so a read asked for there still lands in the bubble. The reply is sanitized in the renderer
(`storyAssistantReplyOf`): blank and repeated ways forward are dropped and at most four kept.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/modEntries/story-assistant.ts` | The switch and its options |
| `src/shared/storyAssistant.ts` | The id, option ids, limits, reply and config shapes, and their cleaning |
| `src/shared/relationship.ts` | `contactRevealsOf`, the contact page's reveal rule, shared with the page |
| `src/renderer/prompts/storyAssistantPrompt.ts` | The shipped prompt, the pure request builder and the name masking |
| `src/renderer/stores/storyAssistant.ts` | The seat's gate, the store holding the config and the read, the context read off the stores, and the call |
| `src/renderer/views/StoryAssistantStage.tsx` | The bubble and the menu over the stage, and the pop-up's own ask |
| `src/renderer/views/StoryAssistantPanel.tsx` | The rail seat, the panel and the mark |
| `src/renderer/views/StoryAssistantPage.tsx` | The mod's page on the Mods screen |
| `src/renderer/vu_styles/StoryAssistant.css` | All three surfaces' layout |
| `src/renderer/modEntries/story-assistant.ts` | Registers `scenePlay`, `stageLayer` and `modDetail` |
| `src/main/services/storyAssistantService.ts`, `src/web/storyAssistant.ts` | Where the prompt is kept, per build |
| `src/main/ipc.ts`, `src/preload/*`, `src/web/bridge.ts` | The read channel and the config channels |

## How it looks

Over the stage, one column stands between the dialogue box's own insets and ends clear of the
speaker label over the box, so neither the box nor who is talking is covered; the column takes no
pointer, only what is in it does. The bubble is a rounded rectangle on the surface face with the
paper shadow, its foot corner tight where the mark speaks from it, the mark in an accent disc,
and it grows from that corner (`bubbleIn`). The choices are answers, so they take the action
shape, flat on the left, on the surface face; each holds its few words over the turn it sends,
and the menu deals them in as the bubble lands.

The panel is the shared `.vu-sheet` under a title tab, its foot Back, Ask or Read again, then
Send. The question and the turn are ordinary fields; the read is body text at reading size;
each way forward is a quiet `.vu-row` with its few words over the turn it would send. Only the
body scrolls, padded for a hovered row's lift.

The Mods page draws the options as the Mods screen draws any mod's, then the prompt's heading
with **Reset to default** at the end of its row while the prompt is the player's own, and the
prompt in a multiline field.
