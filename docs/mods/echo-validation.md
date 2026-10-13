# Echo portability and live validation — 2026-10-13

## Automated and packaged checks

- All three TypeScript checks passed; desktop and browser production builds compiled.
- Full Vitest suite: **2,316 passed, one existing skip** across 179 files.
- Installer suite: **8 passed**, including added music, exact restoration on uninstall,
  rollback and refusal to overwrite a differing official asset.
- The dependency lockfile passed an offline `npm ci --dry-run --ignore-scripts` check.
- Real local segmentation initialized and processed an existing test image without
  ComfyUI or a paid image request. Visual inspection retained solid dark details and
  removed the previously visible white background fragments.
- Built browser smoke check: upload, PNG reading, download offer and persistence after
  reload passed. No provider requests were made. Database tests also cover upgrading
  existing version-8 storage without losing records.
- Desktop and browser backup tests round-trip finished Echo artwork and reject
  conflicting immutable image IDs before settings/saves change. Older backups without
  an Echo image list remain supported.
- The combined local package launched with its native bridge and separate model,
  music and software notices. The local update retained Story Memory Light; all 1,161
  existing data files and both bundled tracks were hash-verified unchanged.

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

## Remaining limits

This sample is not a model-wide judgment, balance or narrative-quality certification.
Broader character/model playtesting and a fresh release-installer pass on a clean
machine remain release checks. Isolated source builds omitted official character ZIPs.

The first cutout requires about 100 MB of downloadable model/runtime data, with
availability depending on the original host and browser cache. Optional local Megaten
generation still needs ComfyUI, compatible hardware and separately downloaded models.
The downloader's bounds, integrity checks, reuse and cancellation are tested; a new
multi-gigabyte checkpoint download was not repeated during this validation.

Browser custom image endpoints need browser-compatible CORS. Finished artwork travels
in whole-game backups; loose save JSON files do not embed artwork, and recovery sources
are not included. There is no separate single-playthrough export in this source tree.

See [Echo](echo.md), [Reckoning](reckoning.md) and [separate asset licenses](echo-asset-licenses.md).
