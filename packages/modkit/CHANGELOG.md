# @vx/modkit

## 0.2.0

Add `conversationFoot`, a screen slot below a person's message history and before the native
composer. It receives the open `charId`; bot and employer threads do not draw it. Existing hooks
and APIs keep their shapes.

## 0.1.0

The kit exists. Everything a mod could import from core's mod system, under three entry points
(`shared`, `renderer`, `main`), with the hook table, the per-hook compatibility check and the API
report. No hook or API changed in the move. Nothing is published yet: core resolves the kit from
`packages/modkit/src` by alias.
