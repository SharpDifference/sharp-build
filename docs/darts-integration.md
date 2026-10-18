# Venus Darts integration

For the current player guide and mouse-only play instructions, see [Darts](mods/darts.md).

The `integrate/darts-extracurricular-050` branch starts directly from
`venus-extracurriculars/build` main at `50576048` (Venus University 0.5.0).
It ports the Darts pack and its supporting fixes from `feature/darts-multiplayer`
(`5b873a2`), rather than merging the separately imported framework history.
The upstream mini-games framework, aids preferences, native 0.5.0 scene flow,
City Life availability and other community mods remain in the baseline.

The upstream `place.ts` resolver now also follows reached playback backgrounds,
so stale classifier locations and unread queued destinations do not change the table's
venue. Its lorebook matching and City Life checks are retained, including the home-room
sentinel used by home games. The HUD, narrator offers, invitations and running game all
read this same resolver. No location model call is added.

## Play

Run `npm ci`, then `npm run dev` for Electron or `npm run dev:web` for the browser build.
Enable **Mini-games** and **[Nd] Arcade & Bar Games** in Mods, with **Darts** enabled inside the pack. Start a scene with one or two girls at BTB Arcade,
Stalestein Bar or Pino Cola Lounge. Use the existing mini-games HUD button and ask her to
play Darts, or agree to play through ordinary scene dialogue. Narrator-launched games require
NPC agreement, following the framework. Choose **Play alone** from the HUD to play solo
while an NPC is present in the scene; the NPC is not seated as a teammate. Scenes without
NPCs keep the base game's normal one-turn ending. No scene is held open for solo Darts.
Short venue names such as
"pino cola" resolve to the same location as "Pino-Cola Lounge".

Move the mouse over the board to aim. Hold the left mouse button to lock the ellipse;
release to throw exactly where the moving dot is. All match buttons can be clicked.
The canvas no longer binds Arrow keys or Space to aim or throw; its accessible
instructions and game manifest describe the same mouse controls.
The ellipse is drawn only while holding. No reticle or ellipse appears on partner turns.

**Beat the House** shares a countdown of 301, 501 or 701. Play rotates reader, first
girl and second girl where present. The reader gets three visits and each girl two, so
a one-girl table has five visits and a two-girl table seven. Reaching exactly zero on
any region wins for the team. Overshooting cancels that entire visit, restores its
opening balance and immediately hands over. Solo Beat the House gives the reader five visits
(up to fifteen darts), with **My turn** collecting the board between visits. Solo always uses
Beat the House, even if Rival Match was saved as the preferred mode; there are no NPC skill
or reaction calls during solo play.

Solo results follow the framework: the result is shown in the scene, and its account rides
with the next player turn. There is no Darts-specific automatic closing call or override of
scene endings. Games played with NPCs keep the framework's immediate result reaction.

**301 Rival Match** gives the reader and every girl a separate 301 balance for three
rounds. A checkout wins immediately; otherwise the lowest remaining balance wins and
equal lowest balances draw. Both modes are straight-out rather than double-out.

## Native framework behavior

The game uses the full `screen` surface, with darts-specific styling that removes its
paper frame. The scene background remains visible, the board is large, score is on the
right and native dialogue stays below it. Other mini-games keep their own surfaces.

The framework owns scene availability, invitations, options, NPC skill, the native
text box and sprite, pacing, walking away and reporting the result to the narrator.
No separate darts HUD launcher, portrait, floating speech card or provider-key field
is added. The pack uses the Venus model and credential settings through `play.round`.

The original scene action row is hidden, inert and disabled while a game owns input,
including a solo game without chat. Its existing caret is released and its unsent draft
is preserved for when the table closes. This prevents the original "What do you do?"
field from showing behind the table's hover divider during the player's first turn.

The framework's optional table chat uses the scene's hover-to-show divider. Focus holds it
open while typing; sending a remark puts it away. A new dialogue line closes a hover-only
peek while leaving a focused draft open. Games
with `typed` input (such as Truth or Dare), and any active `play.ask`, keep the input visible.
Between prompts, a typed game keeps a one-line-height disabled field with an instruction
to use the game panel; when `play.ask` requests text, the field becomes editable.
The native dialogue box follows the actual input height and the same raised/reading states
as normal scenes, so multiline answers do not overlap it. This layout is transient and is
cleared when the table closes; it adds no model calls or changes to game sequencing.

Skill is judged and cached by the framework, 1–5 per NPC/game/playthrough. The same
one-off model call now judges three signed Darts tendencies from personality, traits,
likes and backstory: accuracy, consistency and composure. Darts combines overall skill,
those -2..2 biases and a small stable identity variation into independent 0..100 traits.
They are not a split of 100. A versioned Darts-only cache key causes one fresh judgment
for old playthroughs; later matches reuse it. Failure falls back to skill 3 and neutral
biases. Each throw still advances the engine's seeded randomness.

A sitting follows the framework's transient-match behavior: an agreement can survive
reload before the table opens, but an active match does not resume after reloading.
Walking away supplies an unfinished account to the scene. Standalone saves are separate.

## AI timing

After the player's visit, the engine fixes every consecutive NPC visit in memory before
asking for dialogue. With two girls this is one chronological batch, not one call per
girl or dart. It supplies speaker ids, actual player points, current and remaining scores,
and every planned NPC hit with its remainingBefore/remainingAfter, bust and outcome. The
model returns only lines and native expression ids keyed to speaker and throw; it cannot
change hits. A bust or checkout can shorten the block, and a checkout prevents any later
girl from being planned or shown.

Those score facts establish the moment; they are not a script for an announcer. The
request asks the model to continue the NPC's personality, relationship, recent dialogue
and scene mood through varied teammate banter. It may tease, encourage, flirt, joke,
show nerves or talk light strategy. Scores and hit labels are mentioned only when they
sound natural because the board already shows them.

- Quiet: no unsolicited reaction calls or speech.
- Some: one batch for the consecutive NPC block; each girl gets an intro and up to one noteworthy impact reaction.
- Lots: one batch for the consecutive NPC block; each girl gets an intro, each non-final impact and a non-final closing.

The first intro finishes before **Change turn** unlocks. An NPC dart flies, score and LEDs
respond at impact, then 350 ms passes before its bound reaction and expression. Each line
finishes before a 550 ms pre-throw beat and the next automatic dart. A 700 ms handover
separates two girls, then the next girl's intro appears with her own sprite. Overflow and
reader-paced mode use the native framework. **My turn** unlocks only after every scheduled
visit and closing. The final match reaction belongs to the narrator after `play.finish`;
it is not requested or spoken a second time.

Invalid, overlong or unavailable model output uses engine-aware fallback lines. Late
responses from a closed table are ignored. Unmount clears canvas frames, observers,
audio and timers. Automatic throws pause while the window is away.

## Small framework extensions

The temporary `soloScene`, `keepOpen` and `finishSolo` extensions have been removed.
Narrator invitations, scene reply hooks and the turn runner use their pre-solo behavior.
Location-name normalization remains, including the short name "pino cola". No automatic
venue selection has been added.

Mini-game availability now follows the last reached scene background, with the classifier
location used only before a scene background has been reached. The HUD, narrator offers,
agreement validation and game location use the same resolver. This does not mutate the
base scene location or read cosmetic overrides or unread queued backgrounds. See
[the framework fixes PR](https://github.com/venus-extracurriculars/build/pull/76) for the bug report and scope.

`GamePlay.speak(charId, text, expression?)` accepts an optional native `TableExpression`.
It appears with the queued line as a normal sprite action, preserving the current outfit,
normal playback and rewind. Older two-argument callers keep their behavior. Darts uses
only the seven native expressions, not focused/confident sprite ids from the standalone.

The renderer kit exposes `useEffectsGain()`, following the saved Venus SFX slider's squared
gain. The local mute switch multiplies that gain, so it cannot bypass global SFX mute.
`MiniGamePanel` exposes the current game id as a data attribute for scoped pack styling.

## 0.5.0 integration verification

- All three TypeScript checks and the Electron production build pass.
- 109 focused tests pass across 10 files, covering Darts ledgers/traits, packs, seating, preferences, reached locations,
  City Life availability, home-room games, mod hooks and scene turn failure handling.
- Browser checks use mocked model replies, with no paid calls: real HUD/offer/agreement
  transitions, ignored queued destination/cosmetic overrides, native input hover/focus,
  multiline text, Truth or Dare required answers, and cleanup.
- Darts browser regression checks four PC resolutions, two-NPC batched reactions,
  six paced NPC landings, expressions, score guide, SFX mute, silhouettes and one result
  handoff. HUD solo and narrator NPC-agreement requirements are checked separately.
- This is source/build/browser validation on Linux, not a Windows packaged-app playtest
  or live provider test. The whole repository test suite is not claimed as passing.

## NPC precision balance

High stats now reduce the NPC scatter radius nonlinearly. Accuracy controls the group's
base radius; consistency limits its throw-to-throw radius variation; composure limits the
extra spread on late visits or balances of 60 or less. All three remain independent.
The LLM skill judgment, cached biases, character-derived traits, targeting strategy,
number of random draws and preplanned reaction flow are unchanged. Player aim is unchanged.

The previous linear spread left a level-four player missing a narrow triple/double band
most of the time, especially under pressure. The new radius is measured against the
board radius: base `0.024 + 0.30 * (1 - accuracy/100)^2`, variation
`0.06 * (1 - consistency/100)^2`, plus pressure
`0.06 * (1 - composure/100)^2` only when pressure is active.

A deterministic audit used the reported Rosalie ID with level 4 and biases +1/+1/0:
3,000 seeded 701 matches per condition, three reader misses before the sampled NPC visit,
and 9,000 sampled NPC darts per condition. The pressure case samples the second NPC visit.
Seeds are `(trial + 1) * 2654435761` modulo 2^32. Targeting includes doubles near the edge;
these are landing rates against the chosen scoring region, not match win rates.

| Condition | Exact target region before | After | OUT before | After |
| --- | ---: | ---: | ---: | ---: |
| First NPC visit | 39.7% | 70.3% | 5.3% | 2.6% |
| Late NPC visit | 27.1% | 60.0% | 6.0% | 3.3% |

Five regression tests sample distributions rather than individual lucky throws: strong
players outperform beginners, higher accuracy tightens groups, consistency limits wide
throws, and composure only changes pressure behavior. Existing cached skill data is
reused; start a new match after updating so its plans use the new balance.


## First-turn input overlap regression

The earlier input checks mounted the native dialogue box with the table, but did not mount
`SceneChrome` and its original action field. A real first turn could therefore show the
scene field behind the table's divider even though table chat itself was correctly hidden.
`GameView` now passes transient table input ownership to `SceneChrome`, which hides and
inerts its action row, disables its field and releases its caret until ownership ends.
No normal scene behavior changes when there is no running table.

The regression was reproduced with real `SceneChrome` before this fix. Browser checks now
mount both input layers, cover first-turn ownership, existing focus and draft preservation,
multiline chat clearance at 2048×1218, 1080p and 720p, solo with no chat row, restoration on
exit, and Truth or Dare's always-visible required answers.

## Pack-owned result narration

`MiniGameDef.resultBrief` is an optional array of static prompt directions. For completed
games with NPC participants it replaces only the generic opening cue; the framework still
supplies the settled outcome, account, names and stake. Missing or empty arrays retain the
original cue. Solo results, cancellations and broken games use their existing paths.
Darts declares its aftermath directions in its own manifest. The generic table code has
no Darts-specific result branch.

## Review branches and proposed PR descriptions

These branches are prepared for review; no pull requests have been opened. Both start
from Extracurriculars main `5057604848ebe6c875bb9568f47748d4d3a5975b` (base game 0.5.0).
Merge the framework fixes first, then target the Darts branch at the updated upstream main.
Until then, compare Darts against the fixes branch to review only its own changes.

### Framework fixes

Branch: `fix/minigame-location-input`

Proposed title: **Fix mini-game availability after scene moves and input overlap**

A scene can reach Pino-Cola while the opening classifier still says dorm or no venue,
leaving venue-bound games absent from the HUD and narrator offer. Resolve availability
from reached backgrounds, retaining City Life and lorebook support. Queued backgrounds
and cosmetic overrides do not unlock destination games early.

Running tables temporarily own scene input, keeping the underlying action row hidden and
inert while preserving its draft. Optional chat uses the native hover divider; required
answers remain visible, and dialogue clears the measured input height.

This branch contains framework fixes and bug reports only. It adds no Darts pack, game
rules, result API or extra model calls, and preserves NPC agreement and scene closing.
Validation: 88 focused tests, all TypeScript checks and production build passed on this
branch independently. Prior mock-browser checks covered native input ownership and typed
answers; Windows Electron and paid live models were not exercised for this preparation.

### Darts pack

Branch: `feature/darts-extracurricular-050-pr`

Proposed title: **Add Venus Darts as an Arcade & Bar Games pack**

Adds the mouse-controlled Darts pack at Pino-Cola, BTB Arcade and Stalestein Bar, including
Beat the House and Rival modes, up to two NPC participants, assets, audio, score guide
and paced dialogue using the framework's native sprites and dialogue box. The board and UI
form a transparent overlay with the background and NPC sprites visible behind them. The engine
determines throws; model responses supply skill judgments and contextual reactions.

Includes optional pack APIs for ability axes, bound expressions, SFX gain and result
narration directions. Darts keeps its aftermath instructions in its own manifest.
Other packs keep their default result cue; solo, abandoned and broken results retain
their existing handoff. There are no special solo scene or fixed stat-reward rules.

Depends on the framework-fixes branch above. Validation: 118 focused tests, all TypeScript
checks and production build passed. Result tests cover completed outcomes, custom and
missing cues, solo handoff, abandonment and broken games. Browser replies use mocks;
no Windows Electron or paid live model validation is claimed.
