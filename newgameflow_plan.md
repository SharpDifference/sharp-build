# New Game flow — staged plan

Working document for the agents building the New Game flow, one stage per chat, in order. It stays **untracked**: update the Progress log at the bottom when you finish, and never commit this file (root files reach the public mirror).

## How to use this plan

- Read, in order: `CLAUDE.md`, `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md` if your stage puts anything on screen, Part 1 below, your own stage in Part 2, and the Progress log. Then do your own research and planning — this file fixes scope, decisions and known traps, not implementation.
- Finish your whole stage in one chat, and leave the next one whatever it needs in the log.
- Every stage ends in one commit to main that passes `npm run typecheck` and `npm test`, leaves out this file, and leaves out unrelated working-tree changes (check `git status` first).
- Exercise in the running app whatever your stage makes reachable (the memory index lists the browser-build drivers and the mock endpoint, `new-game-engine-harness` above all); log what you could not reach.
- Every decision here was made with the user. If the code makes one wrong or impossible, ask the user rather than deviate quietly, and log the outcome. Items marked **open** are to be settled with the user at the start of their stage.
- Update the guides for what your stage makes untrue (1.7 lists the known statements). Suggest `TESTING_PLAN.md` changes in your final message; never edit it.

**Scope cut (stage 7, Oct 26 2026).** The flow once planned a total overhaul of the setting — the university's and city's names, the currency, the arrival scroll, rewordable fixed occasions, playthrough backgrounds, places and the map, employers and shops, and a setting zip. The setting is too ingrained in the code for that, and an editor of all of it would confuse the player. It is cancelled for good: the player edits the setting text and the lorebook, exactly as the phone's tab already lets them, and nothing else of the setting. Do not reintroduce a world record or anything like it.

---

## Part 1 — The design

### 1.1 The flow

New Game opens a run of full screens; Quickstart is unchanged. Every screen has a header hint, Cancel, Back (except the first) and a footer with Next. Esc anywhere is Cancel. **Skip generation** (Occasions, Profiles, Classes) is a second Next: it leaves the screen as Next does, marking that screen's calls skipped, so they are never sent and their blanks are filled from pools; whichever of the two the player last left a screen by decides.

| # | Screen | What the player does there | Next |
|---|---|---|---|
| 1 | **Setting** — a vertical tab rail: Setting, Lorebook | Edits the playthrough's setting text and lorebook (1.4). | — |
| 2 | **Occasions** | The semester's occasions on one list: the fixed ones read-only, the generated ones as blank title/description fields. Foot: Import, Export, Clear; Skip generation. | sends the occasions call |
| 3 | **Characters** | The roster screen, its "Start game" now "Next". Stage 8 lets Next leave empty slots to a hidden random draw. | — |
| 4 | **Profiles** | Every girl's profile, every field blank-to-generate but her break posts, which the player never writes; secrets; pairs; her start state with the reader, memories in a modal. Skip generation. | sends profiles and secrets; Skip instead picks a major for every girl without one |
| 5 | **Classes** | The pools and interest classes at once, each major's four once the profile reply has decided it (its wait and failure shown there). Skip generation. | sends classes |
| 6 | **Loading** | Heights → Voices → curtain → name, stats and bio; then the curtain's caption names the earliest call still out. | once every reply is in, the enrollment replaces the application and the registrar opens |

A fresh New Game opens on a welcome modal first (stage 8). The registrar and Finalize are as before, except that Finalize also writes the start state the Profiles screen set: memories, milestones, relationships.

### 1.2 The calls

| Call | Sent at | Reads | Player-entered values | Skip generation | Caption |
|---|---|---|---|---|---|
| Occasions | Occasions' Next | the playthrough's setting and lorebook; the occasion plan | filled entries are not asked for, and are listed to the model as already on the calendar | not sent; blanks are dealt from the occasions pool | occasions |
| Profiles (with `major` and `majorClassesTaken`) | Profiles' Next | roster, setting, her decided fields | told to the model under her name and laid over the reply; a girl with nothing blank is left out — and a non-freshman always has her break posts blank, so she is always asked | not sent; majors picked at the Skip (kept apart from her fields, dropped by a Back onto Profiles); everything else filled at composition from pools and `odds.ts`; a blank class load is 4 with 1 major class; **no break posts** | profiles |
| Secrets | Profiles' Next | roster, setting, filled secrets, milestones (sex as `hadSex`) | filled tiers are not asked for | the secrets pool, by tier | profiles |
| Classes | Classes' Next, the profile reply already in | roster, every girl's major, setting, filled entries | filled entries listed as already in the catalog; the model writes only the remaining counts | the class pool; majors ignored, each girl's major classes random | class schedule |

- **Banking.** Every reply is banked on the application with a key of the request it answered (a hash of system, user and schema). A Next builds its request again: a key matching a banked or in-flight one sends nothing; otherwise the old call is cancelled, its reply dropped if it still lands, and the new request sent. Whatever is random in a request — the occasion plan's dates and inspiration words — is drawn once and kept on the application.
- A skipped call's pools are drawn once, as the semester is composed, except a skipped profile's majors.
- **Nothing blank, no call** — for every call.
- **Whole entries.** An occasion or catalog entry counts as written only with every field filled; one partly typed is generated whole. Next and Skip name every incomplete entry and every half-set pair (an activity without its place, a job without its shifts) and confirm (`incompleteOf`).
- **Break posts are never player-entered**, on New Game or New Game+: generated on Next, none on Skip.
- **Leaving** the flow — Cancel, Esc, Load Game, quitting — cancels every call. **Resuming** re-sends in the background every call whose screen has been passed and whose reply is not banked.
- **Failures** after the silent retries are held until the curtain, where the Retry modal names every call still missing. The exception is the Classes screen's wait on the profile reply, which shows its failure there.
- **Caption**: the curtain names the earliest-sent call still out — occasions, then profiles, then class schedule.
- Fields stay blank when replies land; generated content is first seen in the game, except the majors on Classes.
- Output tokens of every call are counted onto the application across sessions and carried to the save.

### 1.3 The application (a New Game in progress)

- A per-playthrough record, `application.json`, with its own browser store: the screen, everything entered on every screen, the occasion plan, the reader's name, stats and bio once answered, and each banked reply with its request key. The enrollment replaces it — one transaction in the browser — when the last reply lands.
- Written first, creating the playthrough's folder or row, on the first change or the first Next; nothing before that, so a Cancel before then leaves without asking. Every later change is written too, one write at a time.
- Lorebook writes for the playthrough wait for the application's first write, never creating the folder. Where that write never lands, the enrollment's new folder is handed to the lorebook.
- Load Game and Continue offer an application as they offer a registration — resumed onto its screen, deleted with its playthrough — and a backup carries it. A resume whose lorebook cannot be read goes back to the main menu with the error, leaving the application untouched.
- **Cancel / Esc** asks "Return to main menu?" — "You can continue where you left off later." once the application is kept.
- **Back** puts back what was entered on the screen since it was entered (a resume counts as entering) and throws away every call sent at the previous screen's Next or a later one's — onto Setting or Occasions all four, onto Characters or Profiles profiles, secrets and classes, onto Classes the class call — asking first only where either would lose something. A Back onto Profiles or earlier also empties the catalog and drops a skipped profile's picked majors. The Setting screen has no Back.
- **Resume** opens the screen left; on Loading it reopens Heights, Voices and the curtain, with name, stats and bio filled in.

### 1.4 The setting

- The player edits the playthrough's **setting text** and **lorebook** on the Setting screen, the same `lorebook.json` the phone's Lorebook tab edits in game, kept as it is edited. The Lorebook tab keeps its own World Info import and export.
- Nothing else of the setting is editable, now or later: the names Venus University, VU and Veridan, the currency, the arrival scroll, the fixed occasions, the places and the map, the employers, the shops, the backgrounds, and everything else the code hardcodes. The Setting tab's hint says so.
- Every New Game call reads the playthrough's setting and lorebook. The pools Skip deals from are written for Venus University, which every skip confirm says. The Scene Creator reads the build's setting.

### 1.5 Copy

Draft each several times against the human-written text around it (`CLAUDE.md`); these fix the meaning, not the words, except where quoted.

- Setting header (as shipped): "Everything here is already filled in. Changing it is optional, and leaving it alone is the intended way to play Venus University."
- Setting tab hint (as shipped): "A total overhaul of the setting isn't possible at this time due to hardcoded elements like the places, jobs, shops and backgrounds."
- Welcome modal (stage 8), quoted from the user: title "New game setup", message "Welcome to New game setup! Please note that all setup is optional, and it is recommended not to change anything at all. Anything left blank will be generated.", with a don't-show-again box.
- Occasions, Profiles, Classes: "Anything you leave blank will be generated." (Profiles adds "Leaving it blank is recommended."), and a "Leave blank to generate" placeholder in every field.
- Skip confirms (as shipped): the ready-made lists are written for Venus University, not for the player's setting; Profiles adds that no break posts are written; Classes that majors are ignored.
- Memory modal: a memory under a week old counts twice as much as one under a month old, and four times as much as an older one.
- Heights and Voices: saved to the characters, so they apply to every playthrough.
- Back: every change on this screen will be lost — and, when it throws calls away, that generation in progress or finished goes too.
- Next over incomplete entries or half-set pairs: which ones, that they will be generated and what was typed lost.
- Characters (stage 8): an empty tile shows "?" until hovered or focused, then "+".

### 1.6 Web and desktop

- Everything in the flow works in both builds; nothing in it needs ComfyUI.
- The occasions file: the desktop's native dialogs; the browser's file chooser and download panel.

### 1.7 Statements later stages make untrue

- DESIGN_GUIDE §6: "a stranger is omitted rather than masked" — stage 8's setup spoilers mask a random pick until clicked; add the exception.
- DESIGN_GUIDE §2 New Game: the welcome modal and the surprise roster (stage 8).
- DESIGN_GUIDE §2 Semesters and the lorebook paragraph ("at New Game+ the build's, no playthrough's lorebook being loaded there") — stage 9.

### 1.8 Vocabulary

- **slot** is load-bearing (half a day, and a wardrobe's custom slot): an occasion or catalog item is an **entry**, never a slot.
- **application** — a New Game in progress; **fixed** and **generated** occasions; **random pick** — a roster girl Next drew for an empty slot (stage 8).

---

## Part 2 — Stages

### Stages 1–6 — done

1 Generation engine (`aed8ea4`), 2 Skip generation (`2ef7c4a`), 3 Records (`1ba7efc`), 4 The flow shell (`afd321d`), 5 Occasions and Classes screens (`8471590`), 6 Profiles screen (`12169bb`). Part 3 says what each landed.

### Stage 7 — Scope cut — done (`1fb8763`)

The setting overhaul cancelled (see the top), its world record removed, break posts taken off the Profiles screen, and the review's bugs fixed. Logged in Part 3.

### Stage 8 — Welcome modal and surprise roster — done (`bdc6981`)

**Goal.** A fresh New Game opens on a welcome; the Characters screen can leave its empty slots to a random draw the player does not see.

**In scope**
- **Welcome modal**, on a fresh New Game only — never on a resumed application, never on New Game+. The 1.5 copy, and a "don't show again" box that turns off a new install-wide setting, with a Settings Game-tab checkbox to turn it back on. `warnEndingInterrupt` is the pattern end to end: `shared/types.ts`, `settingsRules.ts`, `settingsStore.ts`, `AppSettingsModal`, and `GameView`'s `InterruptEndingModal` (a `CheckField` in the confirm's `aside`). The Setting screen's header hint stays.
- **Characters**: an empty tile shows "?" until hovered or focused, then "+" as now. Next is live with fewer than twelve picked. Next fills every empty slot at random — eligible (rendered, not picked, not a graduate), first names unique against the roster and the graduates — and goes on without showing who. Where the eligible pool cannot fill the roster, Next says so and stays. "Fill empty slots randomly" stays and shows its picks as today.
- **Random picks** are kept on the application apart from the player's own picks — so a resume keeps them and the requests built on them stay banked — and are roster girls in every other way: their profiles, secrets, pairs and interest classes are generated or entered like anyone's.
- **Spoilers**: wherever setup shows a random pick's name or face — Profiles' list rows, its pane heading, the pair selects, the secrets line, the memory modal; Classes' majors' "Taken by" lines and interest-class labels; Next's and Skip's unfinished-entry names; Heights and Voices — it is masked behind a spoiler until clicked. Clicking reveals that girl everywhere for the rest of setup, the reveal kept on the application.
- **Back onto Characters** drops the random picks; their tiles go back to "?" and the next Next draws afresh. Their entries in `girls` and `pairs` stay in the draft, ignored, as for a girl taken off the roster.
- The guide's §6 exception for setup spoilers (1.7).

**Read first.** `views/NewGameRoster.tsx` (`useRoster`, `fillRandom`, `EmptyTile`); `NewGameFlow.tsx` (`flowNext`, `next()`, the Back confirm); `shared/application.ts` (`entriesOf`, which Back compares — add the picks and reveals there); `applicationStore.ts` (`rosterOf`, `callsFrom`); `NewGameProfiles.tsx`, `NewGameClasses.tsx`, `CharacterHeightModal.tsx`, `CharacterVoiceModal.tsx`, `StartMemoriesModal.tsx` for the spoiler sites; the UI guide.

**Gotchas**
- The duplicate first-name check runs on the player's picks; the draw itself avoids duplicates.
- The occasions request reads nothing of the roster, so the occasions call survives a Back onto Characters; if the stage makes an earlier call depend on the roster, `CALL_SCREEN` and `callsFrom` change with it.
- `rosterOf` resolves every pick from the character store, so a random pick later deleted makes the application unloadable, as any roster girl does.

**Open with the user**
- "New game setup" as quoted, or "New Game setup" as the menu spells it.
- Where spoilers end: at the registrar, or only once the game starts.
- Whether a Back onto Characters also drops a random pick the player has revealed.

### Stage 9 — New Game+ — done (`844205c`)

**Goal.** The ending's Continue opens the same flow for the next semester.

**In scope**
- **Setting**: edits the playthrough's own setting and lorebook — every save of it sees the change, as the phone's tab already does — and the four calls read them (today New Game+ reads the build's setting, no playthrough lorebook being loaded there).
- **Occasions** for its season; a fall has its own fixed calendar.
- **Characters** as today — continuing girls locked, graduates kept off — with stage 8's random draw for the empty slots.
- **Profiles**: newcomers as on a first semester — every field but break posts, secrets, pairs, and their start state with the reader, memories and milestones and contact included (extend `charStartOf` and the memory modal past the first semester, dates counted from this semester's day 0). Returning girls shown read-only — nothing editable. Each graduate leaving at the last ceremony: her "what she's doing now" editable, blank to generate.
- **Classes**: the catalog around the returning majors and away from every class the line ran.
- **Break posts** for returning girls and graduates: generated on Next as today, none on Skip.
- **Skip** pools still missing: graduates' pursuits; a returning girl's extra devoted secret, unlike any she holds; class draws kept away from the timeline's `taken` (filtering `items` before `drawMany` makes the bag forget the filtered keys, so filter the draws instead). Fall occasion pools already exist; spring break plans come from their pool.
- No welcome modal.
- The application beside the record, as the registration is, carrying the continuation; Continue and Load Game resuming it; Back's existing confirm on New Game+ reconciled with 1.3.
- Moving `stageContinuation`, `startNextSemester` and `composeNext` onto the engine.

**Read first.** DESIGN_GUIDE §2 Semesters; `stageContinuation`, `startNextSemester` and `composeNext` in `stores/newGame.ts`; `buildContinuedProfilePrompt` and `validateContinuedProfiles`; `stores/semesterCarry.ts`, `stores/semesterStart.ts`; `NewGameView.tsx`'s New Game+ roster and `enrollNext`; the New Game+ harness in memory.

**Gotchas**
- `NewGameView` clears the staged continuation on mount; the application must hold it instead.
- A returning girl keeps her employer, haunts and class load; a returning girl is asked for one more devoted secret.
- New Game+ still asks first-years' majors in its class call (`askLoads: true`, majors given only for returning girls); on the engine, majors come from the profile call as on a first semester.
- `NextSemesterResult` omits `starts`/`pairs`; `continuedStartOf` builds charInfo itself.
- A New Game+ application sits beside a record: relax `APPLICATION_SETTLED` for one carrying a continuation, list it as `withRegistration` lists a registration, and pass `continued` on every `saves.enroll` with an id (a draft without it means a first semester).
- `useRoster` takes `alumni`/`locked` already.

### Stage 10 — Save as typed — done (`25cdeb0`)

**Scope cut with the user (Oct 27 2026).** The planned close-wait (the desktop window holding its ✕ until queued writes land) was dropped: every JSON write is temp-then-rename, so nothing can be torn, and a queued write is lost only to a ✕ within milliseconds of it (about 1.3 s at worst under a Defender hold). The real gap was text never queued at all: the New Game Setting box and a lorebook entry's description saved only on blur or unmount, so a ✕ with the caret in either lost the typing every time, on both builds. Stage 10 makes both save as typed.

### Accepted, not planned

- A Manage Characters generation that lands while the flow is open is tallied onto the application's tokens. It is a lifetime counter, and Quickstart, New Game+ and play share the exposure.
- An application never written whose enrollment also fails: Finalize mints its own folder and the held lorebook edits are lost.

---

## Part 3 — Progress log

Each stage adds an entry: the commit, what landed, any deviation and why, what it could not exercise, and notes for the next stage.

### Stage 1 — Generation engine · `aed8ea4` (Oct 24 2026)

**Landed**
- `src/shared/application.ts`: `ApplicationDraft` (screen, season, chars, plan, occasions, catalog, girls with `DecidedProfile` / secrets / milestones / memories, pairs, reader, replies, tokensGenerated), `PlannedOccasion`, `CALL_SCREEN`, `POOL_SIZES` / `CLASSES_PER_MAJOR`, `PROFILE_FIELDS`, `occasionFilled`, `courseFilled`, `profileFieldDecided` / `profileBlanks`, `secretTiersBlank`, `incompleteOf`, `emptyCatalog`, `emptyGirl`.
- Builders: the profile call asks `major` (folded case-insensitively onto one spelling, a decided one first, `majorSpeller`) and `majorClassesTaken`, lists only girls with a blank, prints `decidedProfileOf(profile)` under each as already decided and lays it over her reply before `validatedProfile`. The class call takes `ClassPromptInput { students: { character, major?, interest? }[], filled, taken?, askLoads?, setting }`, asks only the shortfall per pool and per major (a MAJORS block with counts; the catalog's `major` is an enum when every major is given) and returns null when nothing is short. The secrets call groups girls by tier set. The occasion call takes `{ season, asked, written, setting, book }`. All four carry the setting.
- `stores/applicationCompose.ts` (pure): `needOf(call, draft, roster, world)` → `'none' | 'waiting' | { request, key, check }`; `bankAnswers`; `majorsOf`; `composeApplication` → `StartResult`. `RequestWorld` is `{ setting, book }`.
- `stores/applicationStore.ts`: `useApplicationStore`, `beginApplication`, `openApplication`, `updateApplication`, `sendCalls()`, `callsHeldFrom` / `discardCallsFrom`, `retryCalls`, `leaveApplication`, `settledOutcome()`, `captionOf(state)`, `CALL_LABELS`. Each send has its own group `newGame:<call>:<n>`; a profiles landing re-runs `sendCalls()`, which is the class chain.

**Deviations, all with the user:** whole entries only, with Next's incomplete-entries confirm; no call without blanks for every call; Back throws away the calls that can drift; paired profile fields are one unit; New Game+ keeps asking first-years' majors in its class call until stage 9.

**Not exercised then:** Back, resume and persistence (later stages did). Tests: `test/applicationCompose.test.ts`, `test/applicationStore.test.ts`. Browser harness: `ng/` (`mock.mjs` with `/gen-delay` and `/gen-fail`, `genReplies.mjs`, `first.mjs`, `stage1.mjs` for New Game+, `quick.mjs`).

### Stage 2 — Skip generation · `2ef7c4a` (Oct 25 2026)

**Landed**
- Pools in `prompts/`: `occasionPool.ts` (per season gala, dance, weekly fillers by day/night, break fillers; career fair and concert shared by both seasons), `profilePool.ts` (24 majors, 30 activities three per activity place, 24 spring break plans), `secretPool.ts` (24 a tier, `{name}` rendered by `secretFor`), `classPool.ts` (PE 20, humanities 10, arts 10, misc 64, interest 24; codes unique across pools). Bags are `newGame.*`.
- `shared/application.ts`: `CALL_SCREEN.occasions = 'occasions'`; `callsOfScreen`; `skipped?` and `dealtMajors?`; `isSkipped`; `decidedFieldsOf`.
- `shared/odds.ts`: `SKIP_*` chances for skipped profiles.
- `stores/applicationSkip.ts` (pure, `deal` + `rand` injected): `majorsLacking`, `dealMajors` (⌈2n/3⌉ distinct, shared), `dealSkips` → `SkipFill`.
- `stores/applicationCompose.ts`: `needOf` answers `'none'` for a skipped call (`'waiting'` for a skipped catalog until majors are known); `skippedMajorsOf`; `composeApplication(draft, roster, world, fill?)`.
- `classPrompt.ts`: `validateClassDraft(..., { openMajors })`, `dealtClassReply`, `shortfallOf`. `classScheduler.ts`: a girl's major load takes her own major's classes, then major classes of no major.
- `stores/applicationStore.ts`: `passScreen(skip?)`; `sendCalls()` first picks missing majors while profiles are skipped and passed; `discardCallsFrom` drops `dealtMajors` with the profiles; `verdictOf` deals and composes inside its `try`.

**Decisions with the user:** Skip is a second Next; the occasions call moved to Occasions' Next; skipped majors picked at Profiles' Skip and dropped by a Back, never prefilled; everything else drawn and rolled once at composition; a skipped profile writes **no break posts**; misc pool feeds the majorless major classes.

**Notes for later stages**
- Keep one live `settledOutcome()` at a time: each one deals the pools and composes.
- Stage 9: New Game+ skip needs a graduates' pursuits pool, a returning girl's extra devoted secret unlike any she holds, and class pools kept away from the timeline's `taken` — filter the draws, not `items`.

### Stage 3 — Records · `1ba7efc` (Oct 25 2026)

**Landed** (its world record was removed in stage 7)
- `shared/application.ts`: `Application` (draft + `schemaVersion: 1` + `savedAt`), `KeptApplication`. `shared/saveRules.ts`: `APPLICATION_READ`, `readApplicationRecord`, `APPLICATION_INVALID`/`_UNREADABLE`/`_NOT_FOUND`/`_SETTLED`/`_PLAYTHROUGH_GONE`, `stampApplication`, `applicationSummary`. `PlaythroughSummary.applying?: true`.
- Bridge: `saves.apply(draft, id?) → KeptApplication`, `saves.application(id)`. Desktop: `saveService.writeApplication`/`readApplication` (`application.json`; without an id mints the folder, with one runs in the playthrough's turn and refuses a gone folder or one holding an enrollment or record). Browser: the `applications` store (`DB_VERSION` 9).
- `saves.enroll(draft, id)` with no `continued` is a first semester replacing the application in that playthrough; `continued` keeps the next-semester path. `createPlaythrough` drops a stray application; `deletePlaythrough` takes it; backups carry an `applications` map.
- Listing: a playthrough with no save and no enrollment is listed from its application (`applying`), an unreadable one dead with its reason. `saveStore`: `ResolvedApplication`, `isApplication`, `resolveApplication`, `continueNewest` third case. Load Game: "New Game" / "Saved {date}", dead when a roster girl is missing; Continue's subline "new game". Both hand off with `stageApplication(resolved)` + `setView('newGame')`.

**Decisions with the user:** a deleted roster girl keeps the application unloadable, since that tells the player why and lets them restore her.

**Notes for later stages**
- Stage 9: a New Game+ application sits beside a record — see stage 9's gotchas.

### Stage 4 — The flow shell · `afd321d` (Oct 25 2026)

**Landed**
- `views/NewGameFlow.tsx`: the first semester's flow in `views/NewGameFrame.tsx` (corner arch, title row with the step reading, hint row holding the screen's controls, foot with Back … Skip generation, Next; New Game+'s roster wears it too). Every leave is two-phase: blur, record `{ kind, from }`, render with the body unmounted so editors' cleanup commits land, then a `useEffect` acts only while `draft.screen === from`. Cancel/Esc: `applicationKept()` ? confirm : leave. Back: `backCosts()` → straight back or the confirm. Skip: per-screen confirm. Loading: Heights → Voices → `beginCrossing(…, { wait: true })` → `PlayerNameModal initial={draft.reader}` → one `settledOutcome()` → caption subscription → `onComposed` / failure modal (Retry, "Back to classes").
- `views/NewGameSetting.tsx` + css: `.vu-palette--column` rail (Setting with `GlobeIcon`, Lorebook with `LorebookIcon`), the setting box (mounted once the lorebook is `ready`/`refused`, keyed on its revision, commits on blur and unmount, Reset behind a confirm), `LorebookPage settingPill={false}`.
- `views/NewGameRoster.tsx`: `ROSTER_SIZE`, `useRoster`, `RosterGrid`, `RosterModals`, tiles — used by New Game+ and Characters.
- `views/CharacterVoiceModal.tsx` + css; `CharacterHeightModal` takes `note`.
- `NewGameView.tsx` keeps Quickstart, New Game+, the registrar and Finalize; reads and clears `stagedApplication()`; `onComposed` → `sealApplication()` → `enroll(…, folder)` → `leaveApplication()` → `endCrossing` swap.
- `stores/applicationStore.ts`: per-stay `Keeping` + one `writes` chain (newest draft waits; first success sets the folder and calls the lorebook's `homeMinted`); `keepApplication`, `applicationKept`, `applicationSettled`, `applicationWritesPending`, `sealApplication`, `closeApplication`; `entered` snapshot + `backCosts`/`backScreen`; `resumeApplication`; `rosterOf`/`tokensNow`. `shared/application.ts`: `ApplicationEntries`, `entriesOf`.
- `stores/lorebookStore.ts`: `home` (an id, or a New Game's `folder()` called at commit time), `beginNewGame`, `homeMinted` (re-queues a record left unwritten), `editSetting(text, revision)`, `lorebookWritesPending`.
- `stores/characterStore.ts`: `saveHeights` patches the height alone; new `saveVoices`.
- Waits: `boot.ts` `beforeunload` also asks on application and lorebook writes; the restore and the other-playthrough delete await `applicationSettled()`. `MainMenu`: Continue dead while the playthrough listing loads.

**Decisions with the user:** the flourish on every screen; the failure modal's way out is Back to classes; Back asks only when something would be lost; the flow's Lorebook tab has no Edit setting pill.

**Notes for later stages**
- Screens keep their entries in the draft as typed (`updateApplication` on change), so Next/Back read fresh state. Back's `entriesOf` covers plan, occasions, chars, catalog, girls, pairs; add any new entered field there (stage 8's random picks and reveals).
- Stage 9: New Game+ still runs its roster screen in `NewGameView` (in `NewGameFrame`); `useRoster` takes `alumni`/`locked` for it.

### Stage 5 — Occasions and Classes screens · `8471590` (Oct 25 2026)

**Landed**
- `shared/application.ts`: `entryTouched`, `entryEmpty`, `withOccasionWords`, `CatalogSpot`, `catalogEntryAt`, `withCatalogEntry`, `catalogTouched`, `repeatedCodesOf`; `incompleteOf(draft, screen, majors?)`.
- `shared/occasionsFile.ts`: the occasions file (`format: 'venus-university-occasions'`, `schemaVersion: 1`, `season`, entries), `MAX_FILE_OCCASIONS = 40`, `parseOccasionsFile(Text)`, `occasionsFileOf`, `occasionsExportName`. Bridge `occasions.import/export` on both builds; `OCCASIONS_IMPORT_INVALID` permanent.
- `occasionPrompt.ts`: `OCCASION_BRIEFS`, `occasionKindOf`, `planOfImport`.
- `classPrompt.ts`/`classScheduler.ts`: `written?: true` on the player's entries; written classes seated first; the swim swap takes the most-attended PE class not written, none where every attended PE class is written.
- `applicationStore.ts`: `restoreOf` (a Back onto Profiles or earlier empties the catalog), `majorsNow`, `importOccasions`, `exportOccasions`, `clearOccasions`.
- Views: `NewGameEntries.tsx` (list column + pane), `NewGameOccasions.tsx` (fixed occasions read-only in `FixedPane`), `NewGameClasses.tsx`, the frame's `tools` slot after Back, `.vu-newgame` `overflow: clip`, Next/Skip incomplete confirm (`#new-game-incomplete`).

**Decisions with the user:** only the majors wait; a Back onto Profiles empties the whole catalog; written classes seated first; list + pane on both screens; the import checks only the blatantly unusable and counts what it leaves out; orphaned major entries ignored.

**Not exercised:** the live Gemini check of a 40-entry occasions schema — `MAX_FILE_OCCASIONS` is a guess at twice the planner's ~20.

**Notes for later stages**
- Stage 9: `importOccasions` refuses another season against `draft.season`; fall break small events mint `filler-break-<n>`.

### Stage 6 — Profiles screen · `12169bb` (Oct 26 2026)

**Layout study.** Picked a list + one scrolling pane (the Occasions/Classes object): the list reads each girl's state at a glance; a section palette, a pair matrix and a tile grid opening a modal were rejected. The pane's grid is `auto-fill minmax(240px)`.

**Landed**
- `shared/application.ts`: `StartMilestones` (`datingSince?`/`brokeUpOn?`), `StartBox`, `START_DATE_FIRST/LAST/DEFAULT`, `yearFloorOf`, the editing helpers (`withProfileField`, `withSecret`, `withGirlChanged`, `withPair`, `emptyStartMilestones`, `keptStartMilestones`), the start rules (`startMemoriesOf`, `startAffectionOf`, `startMilestonesOf`, `startDispositionOf`, `startLocksOf`, `startMilestonesWith`, `charStartOf`).
- `shared/types.ts`: `CharStart`; `EnrollmentDraft.starts?` and `.pairs?`. `shared/sceneCreator.ts`: `pairsOver`. `shared/relationship.ts`: `DISPOSITION_LABELS`.
- Composition: `StartResult.starts/pairs`; `secretEntries` reads `hadSex` off the normalized milestones; `validateProfileDraft` lifts a generated year to `yearFloorOf` the decided dorm.
- `NewGameView`: starts/pairs held, enrolled, reread from a reopened enrollment; Finalize writes them, `pairsOver(roll, pairs)` before the winter feeds count friends, and a starting contact queues BunnyBot's handover.
- Orientation: unmet freshmen → unmet anyone → freshmen → anyone; reunion premises for a met girl.
- Views: `NewGameProfiles.tsx`, `StartMemoriesModal.tsx`, `DatePickerModal` (shared with the Scene Creator).

**Decisions with the user:** orientation unmet first with a reunion fallback; date pills for a lover and an ex; a starting contact queues BunnyBot's usual handover. Made in implementation: two lovers who do not share are allowed at start; girls taken off the roster keep their entries, ignored; met is derived from a memory, never stored; the fun list is one unit; Elysium and the first two years lock each other in the selects.

**Not exercised:** texting a starting contact on night 0 by hand.

**Notes for later stages**
- Stage 8: the spoiler sites on Profiles are the list rows (`EntryRow faceOf`), the pane heading, the pair selects' labels, the secrets line and `StartMemoriesModal`'s title.
- Stage 9: `charStartOf`/the memory modal are first-semester only today; newcomers on New Game+ get them. `NextSemesterResult` omits `starts`/`pairs`; `continuedStartOf` builds charInfo itself.

### Stage 7 — Scope cut · `1fb8763` (Oct 26 2026)

**Removed**
- The world record: `shared/world.ts`, `stores/worldStore.ts`, `main/services/worldService.ts`, `web/db/worlds.ts`, the `world.read/write` channels, `getWorldPath`, the `worlds` browser store (`DB_VERSION` stays 9 for `applications`; a dev profile keeps an empty orphan store), the backup's `worlds` map (`perPlaythrough` folded into `applicationsFromBackup`), the `WORLD_*` codes, and the waits on it in `beginSlot`, the orientation, `enterGame`/`resetLoop`, `openApplication`/`leaveApplication`. The class and profile prompts say "a university registrar" / "a university student affairs office" as v0.6.0 did; the graduate lines and "VU's Friendsgiving" are literal again. `RequestWorld` is `{ setting, book }`.
- Break posts as a Profiles field: `breakPosts` stays on `DecidedProfile` only as "none" (a decided freshman's, or a skipped profile's), so a non-freshman always has a blank and is always asked; `writtenPostsOf` gone, `yearFloorOf` reads the dorm alone.

**Fixed** (from a review of stages 1–6, which found nothing that corrupts a save, double-sends or banks the wrong reply)
- `leaveApplication` clears the game store's tallies, so a cancelled New Game's tokens no longer reach the next Quickstart's enrollment.
- `resumeApplication` answers `'opened' | 'refused' | 'left'`; on a refused lorebook it leaves and `NewGameFlow` goes to the menu, the application and its banks untouched.
- `adoptFolder(id)`: where the application was never written, `onComposed` hands the enrollment's folder to the lorebook (`homeMinted`) before leaving; `NewGameView.enroll` answers the id.
- The Setting tab's hint is the 1.5 text.

**Verified** in the browser build against the mock (this session's scratchpad `ng/`, ports 5301/8901): new `cut.mjs` (13 checks — no worlds store, the hint, posts asked of a decided sophomore and not of a decided freshman, a cancelled run's tokens, the refused lorebook and a readable one reopening, every `saves.apply` refused through to the registrar with the setting edit beside the enrollment); reruns `flow.mjs`, `flow2.mjs`, `prof.mjs` (posts checks replaced; it now reads the newest orientation in `mock.jsonl`), `rec.mjs` (world checks dropped, a stale staged-hand-off check fixed), `quick.mjs`, `stage1.mjs`; `desktop.mjs` on the built app. `npm run typecheck`, `npm test` (1727).

**Notes for later stages**
- Stage 8: Back's `entriesOf` is where the random picks and reveals go; `cut.mjs` shows how to read the store and database from the page.

### Stage 8 — Welcome modal and surprise roster · `bdc6981` (Oct 27 2026)

**Decisions with the user:** "New Game setup" as the menu spells it; **no Settings checkbox** — the welcome's box sets `newGameWelcome: false` and only a hand edit of `data/settings.json` turns it back on (the browser build has no file, so there it stays off unless a restored backup's settings say otherwise); masks end at the registrar, the application's Load Game row masking unrevealed picks; a Back onto Characters drops every random pick, revealed ones too, reveals lasting the rest of setup; the heights strip shows a masked girl as a silhouette; Characters' hint "…Any slots you leave empty will be filled at random."

**Landed**
- `shared/application.ts`: `randomPicks?` (on `chars` after the player's own, so composition, banking, `incompleteOf` and the dead-row gate read them unchanged) and `revealed?` (only grows); `maskedOf`, `withoutRandomPicks`. **Not** in `entriesOf`: a Back from Profiles would otherwise count the drop as an edit and ask. `saveRules`: both fields checked as string arrays; `applicationSummary` sets `PlaythroughSummary.masked`.
- `applicationStore`: `passScreen(skip, randomPicks)` writes the picks with the screen change in one write; `backScreen` drops them onto Characters or earlier; `revealPick`, `useMasked`.
- `NewGameRoster`: `drawUnique` (shared by Fill and the draw), `Roster.drawEmpty()`, `RosterGrid surprise` (`?` → `+` by `yielded`/`revealed`). New Game+ passes no `surprise` yet.
- `NewGameFlow`: Next live and doubled at any count, draws or raises `#new-game-short`; `WelcomeModal` (`#new-game-welcome`, `#new-game-welcome-mute`); masked names in the unfinished-entry confirms; masks into Heights/Voices.
- `components/Spoiler.tsx` (`MaskedFace`, `SpoilerName`), `base.css` `.vu-crop--masked`/`.vu-spoiler`; masks in `EntryRow`, `MemoryRow`, Profiles (rows, heading, secrets line, friendzone boxes, pair labels), `StartMemoriesModal`, Classes (majors' subs, Taken by, interest cards), `CharacterHeightModal` (silhouette filter `#vu-heights-mask`), `CharacterVoiceModal`, Load Game's row.
- Settings: `newGameWelcome` through `SETTINGS_REQUIRED`, `mergePatch`, `patchOf`.

**Not masked (accepted):** an error detail well naming a charKey; the rename-collision line of an unloadable application.

**Verified** in this session's scratchpad `65dd837e-aebe-4b62-8dc5-f8a922dce92c/scratchpad/ng/` (ports 5311/8911): `sur.mjs` (54 checks: welcome, tiles, the draw and the shortfall, every mask, a reveal spreading, Load Game's row, Continue keeping masks and banks, Back dropping picks, Classes, Heights/Voices, the registrar); `views8.mjs` (both themes × four sizes); `prod8.mjs` (modal exits on the production bundle, preview 4183); `desktop8.mjs` (the flag in `data/settings.json` and a hand edit bringing it back, the file restored). Reruns: `flow.mjs` (its "Next is dead below twelve" check is now stale), `flow2.mjs`, `prof.mjs`, `quick.mjs`, `stage1.mjs` (plus: New Game+ tiles hold no `?`, Start dead short of twelve). The older drivers now turn the welcome off right after first run. Not exercised: the shortfall modal's exit on the production bundle (no store access there to shrink the pool; it shares the duplicates confirm's presence).

**Notes for stage 9**
- New Game+'s draw: pass `surprise` to its `RosterGrid`, call `drawEmpty()` (it already takes `alumni` as taken), and carry the picks on its application as here.
- No welcome on New Game+: `NewGameFlow` shows it only where `staged === null`; a New Game+ flow must open with something staged or pass its own flag.


### Stage 9 — New Game+ · `844205c` (Oct 27 2026)

**Decisions with the user:** a newcomer may be any year (no break posts, blank pairs strangers, intake this season); a returning girl's Profiles pane is a note only; leaving before the first write is as on New Game (a Setting or Lorebook edit counts as a change); a returning girl keeps last semester's count of major classes (`majorLoads`, read off her timetable in `carryOf`); a second Continue off the same ending reopens a kept, unsettled, resolvable application with the same `parent`, any other is replaced at the fresh one's first write. Made in planning: Loading asks heights and voices, no name; title "New Game+" with the step reading, no welcome; interest classes editable for every roster girl; only girls who graduated at this ending get an editable pursuit; skipped pursuits from `PURSUITS` (an older graduate keeps hers); skipped class draws avoid `taken` with a fallback; the fall graduate is picked among returning fall-intake seniors only.

**Landed**
- `SemesterHandoff` moved to `shared/types.ts` with `majorLoads`; `ApplicationContinuation`, `ApplicationDraft.continued/pursuits`, `isReturning`, `profileFieldsOf`, `withPursuit`. `reader` is set at begin on New Game+.
- Storage: `withApplication` (listing, both builds); `writeApplication` with `continued` needs the id and the record, refused as settled by the record's semester or a registration with the same id; a continued `writeEnrollment` removes the matching application. `PlaythroughSummary.application`.
- Prompts: `buildProfilePrompt({ next })` (NEW STUDENTS / RETURNING STUDENTS / GRADUATES, `characters` without posts, a decided pursuit said); `validateNextProfiles`; `decidedProfileOf(profile, fields)`; `validateProfileDraft(..., { knownMajors, posts, plans })`. Class call: `askLoads`/`askMajor` gone, `major` required, the item's `major` property only where a major is short. Old `buildContinuedProfilePrompt`/`validateContinuedProfiles` and `newGame.ts`'s `startNextSemester`/`composeNext` etc. deleted.
- Compose: roster split newcomers/returning; returning majors verbatim in every `majorsOf` path, speller seeded with them; `RequestWorld.graduates`; returning academics map for `mergeProfiles`; `StartResult.pursuits/fallGraduate`.
- Skip: `drawManyFromBag(..., accept)` / `Deal` accept; `SkipFill.pursuits/springBreakPlans`; returning secrets unlike held; class draws away from `taken`.
- Store: `Keeping.landed`; `openApplication(draft, id, kept)` with `lorebook.load(id, k.home)` (writes ask the application first); `beginNextApplication(next)`; `continuationOf`/`takenClassesOf` in `semesterCarry.ts`.
- Finalize: `continuedStartOf` opens newcomers on their start, lays pairs over the carry, queues BunnyBot's contact handover.
- Views: `NewGameView` (flow for New Game+, `enrollNext` building the registration), `NewGameFlow` (`continuation` prop), Profiles (Returning sticker rows, Graduates section, `ReturningPane`, `GraduatePane` `#profile-pursuit`), seasons in the date pickers, Classes' taken-code line (`#class-…-taken`), Load Game (`#load-game-resume-application`, kinds, `RESUME_UNLOADABLE`), Continue's "new game+".

**Verified** in this session's scratchpad `577f2b91-4b5f-471f-b805-4781b6294814/scratchpad/ng/` (ports 5321/8921): `ngpa.mjs` plays the testsave to the ending and leaves `profile-end`; `ngp9.mjs` (the ending's Continue → every screen → registrar → the fall's day 0: no welcome, unkept Cancel, a Setting edit kept in the playthrough's lorebook, Continue reopening, fall occasions, locked returning girls and the draw, returning note, a junior in Elysium, a graduate's pursuit carried to the record, no name question, the three request shapes, the registration replacing the application, Finalize under the minted id); `ngp9b.mjs` (Load Game's row and Resume New Game+ pill, a second Continue reopening, every Skip: no posts, pursuits dealt, returning secrets unlike held, no taken class but the fixed SWIM 102); `ngp9v.mjs` (1280×720 shots). Reruns: `flow.mjs` (only its stale "Next dead below twelve"), `prof.mjs`, `sur.mjs`, `quick.mjs`. The continuation on the late testsave is ~160 KB, 1 ms to stringify. `npm run typecheck`, `npm test` (1755).

**Not exercised:** the built desktop app (the storage rules are covered by `saveService.test.ts` on real disk; no channel changed); a Continue from an older ending starting fresh over a kept application (unit-tested); the light theme (the screen held the ending's night); `skip.mjs` is stale since stage 4.

**Notes for stage 10**
- `applicationWritesPending()` now also covers a New Game+ application's writes beside a record.

### Stage 10 — Save as typed · `25cdeb0` (Oct 27 2026)

**Decisions with the user:** the close-wait was dropped (see Stage 10 above); a blur at close was rejected too, since it would only queue a write that races the quit.

**Landed**
- `lorebookStore` `enqueue`: a queued write that has not taken its record yet takes the newest one of the same stay and home (`waiting`), as the application's queue does; the target is still asked at once, so the first keystroke keeps a New Game.
- `NewGameSetting`: the Setting box saves on change (its blur and unmount commits are gone, being redundant). `LorebookPage`: an entry already made saves its description on change; a new entry is still made on blur or unmount, once it is valid.
- `test/lorebookStore.test.ts`: a burst of edits writes only the newest after the write in flight; an edit waiting for one playthrough never folds into the next stay's.

**Verified:** `typed.mjs` (12 checks, browser build: the box written with the caret still in it, the first keystroke keeping the New Game, 16 keystrokes in one write while the application's first write landed, a shipped entry's description, a new entry not made until its box is left and live after, a reload keeping it all); `desktop10.mjs` (built app: the window closed from main with the caret in the Setting box and then in a description, `lorebook.json` holding both after a relaunch, the throwaway playthrough deleted).

### Final check of the flow · `25cdeb0` (Oct 27 2026)

Three Opus reviews (records and storage, engine and composition, views) over `aed8ea4^..HEAD`, each finding traced in the code before acting on it.

**Fixed**
- A Continue off a replayed ending reopened the kept New Game+ (matched on the semester alone), so Finalize wrote the first run's carry. With the user: the continuation keeps the slot save the ending stood on (`Continuation.ending` from `loopState.slotSaveId`, `ApplicationContinuation.ending`), and only the same one reopens; an ending standing on no slot save (reached through the autosave) starts fresh.
- A profiles landing re-sent a call that had failed past its retries while the failure modal named it; the landing pass now wakes the class call alone (`sendCalls(['classes'])`), the rest waiting for Retry. Test added.
- The listing offered a New Game+ application beside a registration of its own semester (desktop only, where removing it can fail after the registration lands); `withApplication` takes the registration's semester id and passes it over.
- A second Escape while a flow modal faded out reached the screen and could leave a fresh New Game for the menu: `shellOpen()` in `useModalShell`, read by the flow's Escape.
- The confirms and Loading's questions now share one wait-mode presence, as the UI guide asks of modals that follow one another. The overlap the review described did not reproduce in the browser build (old code showed no frame with both); kept for the guide.
- The application read checks the catalog's shape (`catalog.<pool>` arrays, `major`/`interest` objects), so a hand-edited one is a dead row rather than a crash on resume.
- Dead code: `catalogTouched`; unused `characters` on `ResolvedApplication`/`StagedApplication`; `RosterGrid`'s `surprise` (always on); `FrameNext`'s `id`/`label`/`doubled` and the single/double variants (Next always stands doubled; `doubled` is now a `MotionStyle`); five exports only their own files used; stale comments (the roster screens, a return from the timetable, break posts in `rollProfiles`).

**Rejected**
- A New Game+ beside an unreadable record opens anyway: the same as a registration there, predating the flow.
- The circle and Escape are dead while New Game+ opens: local reads, a moment long.
- Export double-click offering two files: the browser holds one download offer at a time.
- `keepApplication`, `emptyStartMilestones` and the test-reached exports stay: the tests drive them.

**Verified:** `npm run typecheck`, `npm test`; `esc.mjs` (the double Escape — the old code went back to the menu — and Heights after the Skip confirm); reruns of `typed`, `flow`, `flow2`, `prof`, `sur`, `quick` (ports 5331/8931), `ngp9` and `ngp9b` (ports 5321/8921, since `profile-end`'s data lives on that origin), with their stale checks fixed (SWIM 102 always repeats; the mock's `/last` holds the bare schema; a null and an absent parent).

The flow is complete. Nothing is planned after stage 10.
