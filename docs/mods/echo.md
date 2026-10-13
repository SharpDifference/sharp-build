# Echo

Echo gives the reader and each student a named, symbolic creature and one of 22 original aspects. Matching aspects increase new positive relationship progress by 25%; competing aspects reduce it by 25%. Negative memories are unchanged. This is an experimental feature; the aspect classifier and ability balance need playtesting.

## Setup and customization

Initial aspects come from local keyword cues in personality and backstory, with deterministic tie-breaking. The reader uses their biography and name. This does not make a model request. **Why this type?** explains the profile cues behind the suggestion and is collapsed behind a spoiler label.

Near the end of new-game setup, Echoes offers the same manager used during play. The reader and newly selected students can freely change aspects, names and creature descriptions before starting. Returning students retain their carried choices. During play, students' aspects are locked and the reader has one aspect change; names, creature descriptions, artwork and staging remain editable. Unmet students are hidden from the in-game manager.

Open **Echoes** from the scene sidebar beside Calendar and Settings, or from the corner controls between scenes. Artwork also appears in the Echo section of Photos and contact galleries. The manager follows the game's daytime/nighttime colors; new-game setup uses the light theme.

Name and creature dice offer free suggestions. Save edits before generating: the chosen name supplies visual cues, and the creature type/description shapes the image. Regenerating artwork does not rename the creature or change its aspect. Image prompts discourage captions and lettering, though image models cannot guarantee their absence.

## Artwork and requirements

The default source is Gemini or the image API configured in Settings. **Mods → Echo → Local Megaten artwork** selects the separate ComfyUI workflow instead. This choice affects only Echo artwork. Generation can incur the configured provider's charges. Only the reader's missing artwork gets an automatic first-menu attempt; students are generated individually on request. Upload and Download buttons support user-provided artwork and exporting the finished PNG.

Desktop and browser generation use the same local ISNet subject segmentation through IMG.LY background-removal 1.7.0 and ONNX Runtime Web 1.21.0. **Gemini no longer requires ComfyUI, Python, or a manually installed cutout model.** First use downloads about 100 MB of model/runtime data from the pinned IMG.LY resource URL; later use can reuse the browser cache. No image is uploaded to that host. Initialization finishes before contacting the paid image provider, and failure does not trigger a paid retry. The desktop hosts segmentation in a hidden, sandboxed renderer with no preload or filesystem bridge. Cancellation closes its worker/window. Generated originals are retained before segmentation so a failed cutout does not lose the paid source. White edge refinement is limited to near-white source backgrounds; opaque dark features and enclosed highlights remain.

The optional local workflow uses ComfyUI with `models/checkpoints/novaAnimeXL_ilV190.safetensors` and `models/loras/Megaten_Style.safetensors`. Install ComfyUI through the existing game Setup screen, then use **Set up local artwork → Install local art models** in Echoes. This explicitly downloads missing originals (LoRA about 218 MB, checkpoint about 6.9 GB), verifies pinned byte counts/SHA-256 values, reuses matching files and refuses to overwrite different versions. Cancellation stops the download. Manual installation remains available if the original host refuses a download. The workflow uses LoRA strength 0.7 and the SDXL penultimate encoder layer (-2). Native portraits and Photo Feature retain their own workflows. Browser builds use the configured image API; local ComfyUI is desktop-only.

Model weights are not committed or included in the release. [Megaten Style by emerjk](https://civitai.com/models/1767059/megaten-style-kazuma-kaneko) links to the [Fair AI Public License 1.0-SD](https://freedevproject.org/faipl-1.0-sd/). The creator's Civitai settings permit use without credit, sharing merges and paid generation services, but do not grant sales of generated images, the model or model merges. Those settings and the broader base-license output wording differ; do not treat commercial image/model sales as cleared. Keep the separate model terms when redistributing weights. The installer places the shipped license/permission notice beside the downloaded LoRA. The original license, creator link and software notices are available from the artwork UI and in `assets/echo-public`. This is a license record, not a guarantee about third-party artwork or trademarks.

Browser generation, upload, reading and PNG export use IndexedDB artwork stores and the same bounded image processing. Storage upgrades retain existing records. Custom image endpoints remain subject to their own browser CORS support. Browser storage can be cleared by the host/browser, so use the game's backup export. Generated-image quality still varies by provider.

## Stage and abilities

Each owner's **Stage** section controls X/Y offsets, size, visibility and optional floating motion. Offsets use the game's 1920 × 1080 coordinates, bounded to ±600; size ranges from 25% to 250%. Visibility can inherit the shared setting or use an individual 5–80% override. A 3–20 second float cycle controls speed; reduced-motion preferences stop animation.

The reader appears behind the Reckoning dialog, large on the left: X 25, Y 600, scale 2.39, with 18% visibility and floating enabled by default. Saved adjustments take priority. Girls retain their own defaults and can opt into floating. The reader's Stage settings also hold the saved Reckoning glitch-effects toggle; the same option remains available in Mods when Echo is disabled.

With Breakthrough enabled, each reader aspect offers a one-exchange ability costing 25, 50 or 75 spirit. **Normal Breakthrough remains available at 100**, including with Echo disabled. Abilities use the existing scene request and grant no automatic relationship points. See [the ability catalog and transaction rules](echo-breakthrough.md).

## Persistence and implementation

The auto-discovered shared/renderer entries register the mod and its hooks. Optional `exEcho` save data records aspects, names, creature descriptions, artwork references, stage settings and the reader's change lock. Normalization bounds imported values and accepts earlier prototype data. `modCarry` preserves choices between semesters even while Echo is off; disabling the mod hides presentation and stops affinity without deleting data.

Desktop PNG artwork lives in global `data/echoes/art`; browsers use the `echoArt` IndexedDB store. Saves hold bounded immutable IDs. The supported whole-game backup now includes these images on both platforms, even with Echo disabled; restore preflights PNG bounds, paths and identity collisions before changing saves. Existing identical images are reused, conflicting content is rejected, and older backups without an artwork list still load. There is no dedicated single-playthrough export in the current source: copying only a loose save JSON still omits external artwork. Missing files fall back to a sigil; unreferenced images are retained. Generated originals are kept in desktop `data/echoes/sources` or browser `echoSources`, separately from finished art; those recovery sources are not included in the whole-game backup.

Shared `echo*.ts` modules own normalization, naming, aspects, setup and stage rules. Renderer hooks apply affinity and integrate setup, galleries and scene presentation. Native services isolate API generation, ComfyUI and segmentation. Cancellation and playthrough checks discard stale results. Tests cover these boundaries, aspect locking, setup/carry, artwork identity, prompt text, stage normalization and the ordinary Breakthrough fallback. No personal saves, generated artwork, credentials or model weights belong in this source change.
