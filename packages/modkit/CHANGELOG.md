# @vx/modkit

## 0.2.0

Adds the hooks `gameModals`, `railButton`, `landingTool` and `gameMenuEntry`, and the API
`openPanel` from `@vx/modkit/renderer`.

## 0.1.0

The kit exists. Everything a mod could import from core's mod system, under three entry points
(`shared`, `renderer`, `main`), with the hook table, the per-hook compatibility check and the API
report. No hook or API changed in the move. Nothing is published yet: core resolves the kit from
`packages/modkit/src` by alias.
