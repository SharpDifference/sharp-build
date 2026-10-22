# Prompt Studio

An independent, anytime mod, off by default. **Prompt Studio** in Settings' Advanced tab opens
an editor for what the writer is sent. It imports SillyTavern and Marinara presets and lays
them over scene calls, lets the player rewrite the game's own instructions, and keeps
variables the model updates turn by turn. It adds no AI calls; it changes what the existing
ones say.

## What the player can do

The editor has nine tabs. **Presets** lists them: import, duplicate, rename, export, delete, and
pick the one in force. **Blocks** is the order a scene request is read in: drag a row by its
grip, or step it with its arrows. **Glossary** lists every
`{{…}}` macro the active preset writes, what each becomes when a scene is sent, how many blocks
use it and the variables it names. **Scene text** and **Other prompts** rewrite the game's
instructions. **New Game** rewrites the calls that build a semester, and appears only on the
main menu. **Lorebook** edits the places and things the writer is told about. **Variables**
appears only inside a playthrough. **Preview** shows the last scene request as the active preset
would send it now. The tabs that change the active preset name it at the top.

**Find and replace**, on the Blocks tab and beside each name macro in the Glossary, swaps one
piece of text for another across the preset's blocks, their names and its scene text, never the
game's own sections. It shows how many matches there are as you type. A common use is
swapping `{{user}}` for "the reader" and `{{char}}` for "the characters", the way the game's
own prompts speak.

A built-in Default preset always exists. It holds the game's own sections in their shipped
order and nothing else, and it leaves every request exactly as it is without the mod. The last
preset cannot be deleted.

## What a preset reaches

Only scene calls: the opening, a continuation, the closing, and the solo scene. Texting, the
slot opening, graduation posts, the ledgers, both classifiers and character generation are
never arranged. The game's own sections (persona, reply rules, setting, the reader, cast,
now, class, lorebook, mod notes, story recall, story so far, scene so far, your turn) show
as rows, each with a line saying what it carries. Move them, turn them off, or put the preset's
blocks between them. The reply rules cannot be turned off or moved out of the system prompt.
Once a scene has been played this session, a row the last scene sent offers Example, which
shows that section's text exactly as it went out.

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
- **The studio owns** the solo and ledger persona, the texting persona, the slot opening and
  graduation posts' persona, the character designer's, and the New Game calls' text. Every
  preset shares these, and they take effect whether or not a scene is involved. They are kept
  in the studio's own storage, never in the settings.

The cast scene persona is chosen in this order: the active preset's edit, then the persona
set in Settings, then the shipped one. An edited persona is sent as written whatever the
less-explicit-text setting says; an unedited one still follows it. With the mod off, Advanced's **Edit
system prompt** works as before, and the studio hides it while the mod is on. The summary
instructions stay locked.

## New Game

The **New Game** tab rewrites the four calls that build a semester: the class catalog, the
student profiles, the calendar's occasions and the secrets. A later semester's calls read the
same edits. The tab shows only on the main menu, and each request takes the edits in force
when New Game or New Game+ starts it; a retry sends it again unchanged.

Each call has its system prompt, its prose in one or more blocks, and a **Your additions**
block that ships empty and is added after the system prompt when filled in. An edited block is
sent as written, followed by the lines it used to hold that the game needs: the class pool
sizes and the unique-code rule, the returning-student lines, the break-week note. The fields,
menus, employers and every number a reply is checked against stay fixed, as do the occasions'
setting and places.

**Catalog sizes** sets how many classes the catalog asks for: physical education (1 to 20),
each of humanities, arts and miscellaneous (0 to 15), and each major (1 to 8). A bigger catalog
costs more output tokens and risks a reply cut off before it ends.

## Lorebook

The **Lorebook** tab edits the places and things a scene or a text thread is told about when
its words name them. It works in and out of a game, and a change reaches the next call.
Characters and classes are added from the save on every call and are not edited here.

The game's own lorebook comes first. Each entry can have its text rewritten, be turned off, or
be reset. An entry tied to a place keeps its own trigger keys and can gain more; the few that
are not can have theirs replaced. Casting, the profiles' places and the place minigame
read the shipped entries whatever the player changes.

Below it, the player's own books, each turned on or off, renamed or deleted. An entry has a
name, trigger keys and text, and may be **always on**, sent with every scene and text thread
whatever is said. Turned-off entries are never sent. The slot opening's rumor picks only from
the game's entries that are on.

**Import World Info** reads a SillyTavern World Info file of up to 8 MiB into a new book. Keys,
content, comment, constant and disabled carry over. Entries that rely on secondary keys,
selective logic or a regex key are kept but turned off, with the reason beside them, as are
entries with no usable key that are not constant. Macros such as `{{char}}` are listed, since
lore is sent as written. Nothing is kept until the player confirms the import's report.

The occasions call lists every game entry that is on as its places, edited text included, and
then, under a heading of its own, the player's entries that are on.

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

**Import preset** reads a SillyTavern or Marinara preset file of up to 8 MiB, or one preset
exported from Prompt Studio, which comes in whole as a copy under a new id. The player names
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
- `data/prompt-studio/prompts.json`: the studio's own text edits and the catalog sizes.
- `data/prompt-studio/lorebooks/`: one file per book of the player's, and an index holding the
  edits to the game's entries and the books that are on. The browser build keeps both in its
  database instead.
- `GameSave.presetVars`: the variables, inside each save.

None of it but the variables is in the game's backup, and a restore of one leaves it as it is.
A preset that is missing or unreadable costs only a console warning: the scene goes out as the
game wrote it. The variables travel with the saves.

## Backups

Presets, prompts and lorebooks each have their own **Restore**, on the Presets, Other prompts
and Lorebook tabs. Prompts and lorebooks each have an **Export** beside it, one file holding
that section whole: every text edit and the catalog sizes; every book and the edits to the
game's entries. Presets are exported one at a time, from each preset's row, into a file holding
that preset as the one in force. Restore presets still reads a file of several, from an earlier
build. A restore refuses a file from another section and names what it is,
checks the whole file before writing anything, says what it will add and replace, and then
merges it:

- **Presets** by id, the file's preset taking the place of one with the same id, and the
  file's preset in force becoming the one in force.
- **Prompts** block by block, the file winning; blocks and sizes it does not hold are left as
  they are.
- **Lorebooks** by book id, and entry by entry for the game's own entries, the file winning.
  Books the file has on are turned on, and the rest are left as they are.

A restore writes only its own section, never the settings, saves, characters or the mod
switches, and takes effect without a reload. Prompts restored during a game include the New
Game edits, which can be seen again from the main menu.

## Turning it off

Off stops everything above. Every request is then the game's own, the Advanced tab's Edit
system prompt returns, and the Prompt Studio button hides. Presets, edits, lorebooks and
variables stay saved, so turning it on again finds them.

## Implementation map

- `src/shared/presets/`: the preset shape, the importers, macros, variable ops and the library
  rules. `assemble.ts` finds the game's parts again in the built request and rearranges them;
  `glossary.ts` reads a preset's macros and does its find and replace. `studioPrompts.ts` is the
  prompts record and the catalog size ranges; `studioBackup.ts` the three backup files and how
  each merges.
- `src/shared/lorebooks/`: the book and index shapes and rules, and `importWorldInfo.ts`.
- `src/main/services/presetsService.ts`, `studioPromptsService.ts`, `lorebooksService.ts` and
  `studioBackupService.ts`, with their twins in `src/web/`: the folders and the browser's
  database. `src/main/ipc.ts` and `src/web/bridge.ts` apply the preset where a structured
  request is sent, and read a scene reply's `vars` back.
- `src/renderer/prompts/promptBlocks.ts`: the text blocks and their shipped text, the New Game
  calls' included. `effectiveLore.ts` applies the lorebook edits to the shipped entries.
- `src/renderer/stores/promptStudioStore.ts`, `loreStore.ts` (with `loreNow()`, which is the
  shipped lorebook while the mod is off) and `src/renderer/views/PromptStudio*.tsx`: the studio.
- `test/preset*.test.ts`: assembly, macros, variables, imports and the request path;
  `test/studioPrompts`, `loreBookRules`, `effectiveLore`, `importWorldInfo` and `studioBackup`
  the rest.

## Registration on core 0.3.1

- `src/shared/modEntries/prompt-studio.ts` supplies its mod definition and the semester carry
  for `presetVars`.
- This mod has no renderer hook registration; its integration is switch-gated in place.
