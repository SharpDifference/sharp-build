# @vx/modkit

## 0.3.0

The loader. Installed mods are read from `data/mods/<id>/<version>/` and from the developer
folders, checked against the hook table, and loaded at start: `main.js` in the main process,
`renderer.js` in the window from `vxmod://`, with React, `motion/react` and the kit's entries
reached through the page's import map.

- The manifest, `vxmod.json`: `parseManifest` and `modDefOf` in the host's shared entry, with the
  version-range subset (`range.ts`) `requires`, `optional` and `game` are written in.
- The hook `protocols`, the first main-side row: a `main.js` exports routes under
  `vxmod://<id>/@/<route>/…`.
- `registerHooks` holds an installed mod's registration to its manifest (`setDeclaredHooks`,
  `setLoadingMod` in the host's renderer entry); an in-repo mod registers as before.
- `ModDef.library`: a library mod has no switch and no row on the Mods screen.

## 0.2.0

Adds the hooks `gameModals`, `railButton`, `landingTool` and `gameMenuEntry`, and the API
`openPanel` from `@vx/modkit/renderer`.

- `registerImagePromptDraft` in `shared`, with its types: a mod's tags in her sprite and CG prompt
  drafts, asked in id order while it is on, in the editor and in every render alike.

## 0.1.0

The kit exists. Everything a mod could import from core's mod system, under three entry points
(`shared`, `renderer`, `main`), with the hook table, the per-hook compatibility check and the API
report. No hook or API changed in the move. Nothing is published yet: core resolves the kit from
`packages/modkit/src` by alias.
