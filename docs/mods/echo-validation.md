# Echo validation — 2026-10-13

## Current combined PR checkout

The Echo integration branch was merged with main at 494fb91aa72d504e83d8e31a2d4851239fe5fc26 before the current changes were applied. This includes Incoming Texts and the merged Story Memory Light option. The local experiment checkout was not published wholesale.

- All three TypeScript checks passed (node, web/renderer and tests).
- Full Vitest suite: **2,408 passed, one existing skip, 184 files** with two workers.
- Installer suite: **8 passed**, with all three community music files in the build/test allowlists.
- Desktop and browser production builds passed. Both include all 22 dungeon backgrounds. The browser emits all three MP3s; desktop release packaging supplies them as external assets through the installer allowlist.
- Source regression coverage includes link/entry gates, private Talk limits, aspect hints, first-person whisper filtering and safe placement, rewind/save guards, Unheard Soul character/backup transfers, and soundtrack preview restoration/title toggling.

These checks used an isolated source checkout without the official character ZIPs. They are not a fresh end-to-end installation run or a new live judgment test. No paid model requests were made for this publication update. Earlier local visual/install checks remain historical evidence; the current changes still need broader playtesting and release-machine verification.

## Earlier portability checks

Before the dungeon update, local segmentation ran without ComfyUI; a browser smoke check covered Echo upload/read/download/reload; desktop/browser backup tests covered immutable image IDs and old backups. A packaged copy launched with its native bridge and separate asset notices. Those results do not claim browser parity for the newer desktop-only Unheard Soul editor/portable extension.

## Small live-model check

This was explicitly capped and used **11 text requests and one image request**, with
fictional adult profiles only. No personal save histories or character records were sent.

Text model: `gemini-3.6-flash`.

| Fictional profile | Opening | Supportive answer | Hostile answer / instruction injection |
| --- | --- | --- | --- |
| Independent student wary of being controlled | Valid three thoughts grounded in supplied history | Accepted | Rejected |
| Musician worried that mistakes cost acceptance | Valid three thoughts grounded in supplied history | Accepted | Rejected |
| Overworked organizer afraid to set limits | Valid three thoughts grounded in supplied history | Accepted | Rejected |

The first profile completed all three rounds and earned a valid, individualized growth
tag with three reframes. Reactions retained boundaries and did not assert a permanent
cure. Opening requests took roughly 3.3–3.6 seconds; answer judgments took roughly
1.4–2.9 seconds in this sample. Prepared openings still depend on the actual provider,
network and context size. Some feedback remained more formal than everyday dialogue.

Image model: `gemini-3.1-flash-image`. One original fantasy creature was generated,
segmented locally, read through the native API and exported as a transparent PNG.
Visual inspection found a coherent creature with retained light/dark details and no
caption text. This single result does not guarantee future image quality.


## Remaining release checks and limits

The bounded live sample above predates the newer dungeon Talk/one-time hint flow. It does not certify their tone, model consistency or ability balance. Broader profiles/providers and a fresh clean-machine installer pass remain release checks.

First cutout needs roughly 100 MB of downloadable model/runtime data. Optional local Megaten generation needs ComfyUI, compatible hardware and separate original-host model downloads. Download bounds/hash checks/reuse/cancellation are covered; a new multi-gigabyte download was not repeated. Browser custom image endpoints need compatible CORS.

Ordinary Echo artwork works on desktop and browser and travels in whole-game backups. Loose save JSON does not embed images or recovery originals; there is no separate single-playthrough exporter. Custom Unheard Soul images/staging and their optional portable character extension currently use desktop IPC. The browser uses the inverted normal portrait, and does not promise round-tripping that new extension.

See [Echoes](echo.md), [Breaking Through the Silence](reckoning.md) and [asset notices](echo-asset-licenses.md).
