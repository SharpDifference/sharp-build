# Prompt Studio

An independent, anytime mod, off by default. **Prompt Studio** in Settings' Advanced tab opens
an editor for what the writer is sent. It imports SillyTavern and Marinara presets and lays
them over scene calls, lets the player rewrite the game's own instructions, and keeps
variables the model updates turn by turn. It adds no AI calls; it changes what the existing
ones say.

## What the player can do

The editor has six tabs. **Presets** lists them: import, duplicate, rename, delete, and pick
the one in force. **Blocks** is the order a scene request is read in. **Scene text** and
**Other prompts** rewrite the game's instructions. **Variables** appears only inside a
playthrough. **Preview** shows the last scene request as the active preset would send it now.

A built-in Default preset always exists. It holds the game's own sections in their shipped
order and nothing else, and it leaves every request exactly as it is without the mod. The last
preset cannot be deleted.

## What a preset reaches

Only scene calls: the opening, a continuation, the closing, and the solo scene. Texting, the
slot opening, graduation posts, the ledgers, both classifiers and character generation are
never arranged. The game's own sections (persona, reply rules, setting, the reader, cast,
now, class, lorebook, mod notes, story recall, story so far, scene so far, your turn) show
as rows. Move them, turn them off, or put the preset's blocks between them. The reply rules
cannot be turned off or moved out of the system prompt.

A preset block can be edited, added, deleted, turned on or off, given an XML wrapper, set to
the system, user or assistant role, and placed in order or a number of parts back from the end of
the user text. A block with a macro that changes between calls, such as a dice roll, is marked
**Not cached** when it sits in the system role, since the system prompt is cached.

The **main block** is the imported preset's own main prompt. It goes in right after the game's
persona, and both are sent. **Main block replaces the game persona** drops the persona instead.
It is off by default, and it applies to the solo scene too, where that part is the solo
persona. A preset with no main prompt has no checkbox.

## Text blocks and who owns them

The game's own instructions are text blocks, each editable and each resettable to the shipped
text. An edit equal to the shipped text is stored as no edit.

- **The preset owns** the cast scene's persona and its instructions: the opening, the
  continuation's four parts, the closing and the solo scene. Switching preset swaps them. They
  are edited, not moved, because the lines between them depend on the scene.
- **The settings own** the solo and ledger persona, the texting persona, the slot opening and
  graduation posts' persona, and the character designer's. Every preset shares these, and they
  take effect whether or not a scene is involved. They live in `Settings.promptBlocks`.

The cast scene persona is chosen in this order: the active preset's edit, then the persona
set in Settings, then the shipped one. An edited persona is sent as written whatever the
less-explicit-text setting says; an unedited one still follows it. With the mod off, Advanced's **Edit
system prompt** works as before, and the studio hides it while the mod is on. The summary
instructions stay locked.

## Variables and macros

A preset block may use these macros, and nothing else is resolved:

- `{{user}}` is the reader's first name, `{{char}}` the first cast girl's given name (empty in
  a solo scene) and `{{group}}` every cast girl's, joined with commas.
- `{{setvar::name::value}}`, `{{getvar::name}}` or `{{getvar::name::default}}`,
  `{{addvar::name::n}}`, `{{incvar::name}}` and `{{decvar::name}}`.
- `{{roll::2d6+1}}` and `{{random::a::b::c}}`.
- `{{// a note}}` and `{{trim}}`.

Macros nest and resolve innermost first. What a macro produces is never resolved again, and a
macro the game does not know is sent as written. Macros are resolved only in preset blocks. A
macro typed into scene text, a player's action or any of the game's own text goes to the model
as written.

Each scene reply may also carry a `vars` list of `set`, `add` and `append` changes, which the
preset's blocks can ask the model to use. Replies change at most 50 at a time, a save holds
200 variables, and long names and values are cut. The result is saved with the game in its
`presetVars`, carried into the next semester, and edited or reset from the Variables tab.
Interjecting or rewinding to an earlier line takes back what the cut replies changed.
Loading an older save brings back its variables.

## Samplers

An imported preset may carry temperature, top-p, top-k and a repetition penalty. They are sent
with that preset's scene calls to a custom endpoint, over the same values on Settings'
Advanced tab, and never to Gemini.

## Importing

**Import preset** reads a SillyTavern or Marinara preset file of up to 8 MiB. The player names
it and may swap a word everywhere, since presets often address the model by a name of their
own. Before anything is kept the import lists what it did.

Blocks the game cannot use are kept but turned off, each with the reason beside it: jailbreaks,
image prompts, output that needs HTML or hidden comments, headers, feeds and graphics, a
relationships system the game already has, and turn order or user-agency rules. Regex scripts
are kept for reference and turned off. Dialogue examples are left out. The format's own
character, persona, lorebook, scenario and chat history markers become the game's own
sections. Macros the game does not fill in are listed.

## Where it lives

- `data/presets/`: one file per preset and an index naming the one in force. The browser build
  keeps the same records in its database.
- `GameSave.presetVars`: the variables, inside each save.
- `Settings.promptBlocks`: the global text edits.

Presets are **not** in the backup. A restore leaves the folder as it is, and a preset that is
missing or unreadable costs only a console warning: the scene goes out as the game wrote it.
The variables travel with the saves, and the text edits with the settings.

## Turning it off

Off stops everything above. Every request is then the game's own, the Advanced tab's Edit
system prompt returns, and the Prompt Studio button hides. Presets, edits and variables stay
saved, so turning it on again finds them.

## Implementation map

- `src/shared/presets/`: the preset shape, the importers, macros, variable ops and the library
  rules. `assemble.ts` finds the game's parts again in the built request and rearranges them.
- `src/main/services/presetsService.ts` and `src/web/presets.ts`: the folder and the browser's
  database. `src/main/ipc.ts` and `src/web/bridge.ts` apply the preset where a structured
  request is sent, and read a scene reply's `vars` back.
- `src/renderer/prompts/promptBlocks.ts`: the text blocks and their shipped text.
- `src/renderer/stores/promptStudioStore.ts` and `src/renderer/views/PromptStudioModal*.tsx`:
  the studio.
- `test/preset*.test.ts`: assembly, macros, variables, imports and the request path.

## Registration on core 0.3.1

- `src/shared/modEntries/prompt-studio.ts` supplies its mod definition and the semester carry
  for `presetVars`.
- This mod has no renderer hook registration; its integration is switch-gated in place.
