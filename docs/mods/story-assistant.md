# Story Assistant

Story Assistant is an independent `anytime` switch in Mods (`story-assistant`), off by default.
It needs no other mod.

## Playing

During a cast scene the rail carries a speech-bubble seat. It is live on the reader's turn —
at the action box, or over a finished reply's last line where the row there lets a turn
through — and dim while a reply is still arriving or being read. It is absent where there is
no cast scene to talk about: a solo scene, an exam, a replay, a created scene, the orientation,
the graduation epilogue, and a scene once it has reached its ending.

Opening it reads the scene: a few sentences on how it is going and how each girl seems to be
taking him, and three or four ways forward. **Ask about the scene** takes a question in place of
the general read; **Ask** sends it, **Read again** asks for a fresh read. Picking a way forward
copies its words into **Your turn**, where the player can change them; **Send** takes the turn,
exactly as typing it into the action box would, and closes the panel.

Opening the panel again at the same point shows the read it already has without a new call.
Any change to the scene — a new line, a rewind's cut, a rewritten line, a load — retires it,
and the next open asks again. Reads live in memory only: nothing is written to a save, and
switching the mod off leaves nothing behind.

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

Only a decision point opens the seat, and there every delivered line has been read, so the
running summary covers nothing the player has not seen.

## Cost and failures

Each ask is one structured call on the channel `llm:completeStoryAssistant`, on the main writer
model at the player's own effort; it is not routed to the secondary model and no preset is
applied. Closing the panel, asking again or leaving the game cancels the call in flight. A
reply that lands after the scene has moved is refused, a failure is said inside the panel, and
**Read again** or **Ask** retries it. The reply is sanitized in the renderer
(`storyAssistantReplyOf`): blank and repeated ways forward are dropped and at most four kept.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/modEntries/story-assistant.ts` | The switch |
| `src/shared/storyAssistant.ts` | The id, limits, reply shape and sanitizer |
| `src/shared/relationship.ts` | `contactRevealsOf`, the contact page's reveal rule, shared with the page |
| `src/renderer/prompts/storyAssistantPrompt.ts` | The pure request builder and the name masking |
| `src/renderer/stores/storyAssistant.ts` | The seat's gate, the context read off the stores, the call and the kept read |
| `src/renderer/views/StoryAssistantPanel.tsx` | The rail seat and the panel |
| `src/renderer/vu_styles/StoryAssistant.css` | The panel's layout on the shared sheet |
| `src/renderer/modEntries/story-assistant.ts` | Registers the `scenePlay` hook |
| `src/main/ipc.ts`, `src/preload/*`, `src/web/bridge.ts` | The channel |

## How the panel looks

The panel is the shared `.vu-sheet` under a title tab, its foot Back, Ask or Read again, then
Send. The question and the turn are ordinary fields; the read is body text at reading size;
each way forward is a quiet `.vu-row` with its few words over the turn it would send. Only the
body scrolls, padded for a hovered row's lift.
