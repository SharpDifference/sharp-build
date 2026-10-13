# Echo

Echo gives the reader and each student a named, symbolic creature and one of 22 original aspects. Matching aspects increase new positive relationship progress by 25%; competing aspects reduce it by 25%. Negative memories are unchanged. This is an experimental feature; the aspect classifier and ability balance need playtesting.

## Setup and customization

Initial aspects come from local keyword cues in personality and backstory, with deterministic tie-breaking. The reader uses their biography and name. This does not make a model request. **Why this type?** explains the profile cues behind the suggestion and is collapsed behind a spoiler label.

Near the end of new-game setup, Echoes offers the same manager used during play. The reader and newly selected students can freely change aspects, names and creature descriptions before starting. Returning students retain their carried choices. During play, students' aspects are locked and the reader has one aspect change; names, creature descriptions, artwork and staging remain editable. Unmet students are hidden from the in-game manager.

Open **Echoes** from the scene sidebar beside Calendar and Settings, or from the corner controls between scenes. Artwork also appears in the Echo section of Photos and contact galleries. The manager follows the game's daytime/nighttime colors; new-game setup uses the light theme.

Name and creature dice offer free suggestions. Save edits before generating: the chosen name supplies visual cues, and the creature type/description shapes the image. Regenerating artwork does not rename the creature or change its aspect. Image prompts discourage captions and lettering, though image models cannot guarantee their absence.

## Artwork and requirements

The default source is Gemini or the image API configured in Settings. **Mods → Echo → Local Megaten artwork** selects the separate ComfyUI workflow instead. This choice affects only Echo artwork. Generation can incur the configured provider's charges. Only the reader's missing artwork gets an automatic first-menu attempt; students are generated individually on request. Upload and Download buttons support user-provided artwork and exporting the finished PNG.

Desktop generation requires local subject segmentation even when Gemini draws the image. It preserves opaque dark features while removing the background and refining pale edges. Before making a paid request, the service checks for the game's ComfyUI Python runtime, the Python dependencies used by `assets/workflows/echoCutout.py` (including transparent-background and pymatting), and `<ComfyUI>/.transparent-background/ckpt_base.pth`. Missing dependencies produce an error before contacting the image provider. This PR does not add an automatic model downloader.

The optional local workflow additionally requires `models/checkpoints/novaAnimeXL_ilV190.safetensors` and the user-supplied `models/loras/Megaten_Style.safetensors` in that ComfyUI installation. The workflow uses LoRA strength 0.7 and the SDXL penultimate encoder layer (-2). The [Megaten Style model](https://civitai.com/models/1767059/megaten-style-kazuma-kaneko) and other model weights are not bundled. Native portraits and Photo Feature keep their own workflows.

Generation, upload, PNG reads and export use desktop IPC. The browser build includes aspect assignment, customization, affinity and abilities, but does not yet provide these native artwork operations. Image quality and cutout edges still need provider-specific manual checks.

## Stage and abilities

Each owner's **Stage** section controls X/Y offsets, size, visibility and optional floating motion. Offsets use the game's 1920 × 1080 coordinates, bounded to ±600; size ranges from 25% to 250%. Visibility can inherit the shared setting or use an individual 5–80% override. A 3–20 second float cycle controls speed; reduced-motion preferences stop animation.

The reader appears behind the Reckoning dialog, large on the left: X 25, Y 600, scale 2.39, with 18% visibility and floating enabled by default. Saved adjustments take priority. Girls retain their own defaults and can opt into floating. The reader's Stage settings also hold the saved Reckoning glitch-effects toggle; the same option remains available in Mods when Echo is disabled.

With Breakthrough enabled, each reader aspect offers a one-exchange ability costing 25, 50 or 75 spirit. **Normal Breakthrough remains available at 100**, including with Echo disabled. Abilities use the existing scene request and grant no automatic relationship points. See [the ability catalog and transaction rules](echo-breakthrough.md).

## Persistence and implementation

The auto-discovered shared/renderer entries register the mod and its hooks. Optional `exEcho` save data records aspects, names, creature descriptions, artwork references, stage settings and the reader's change lock. Normalization bounds imported values and accepts earlier prototype data. `modCarry` preserves choices between semesters even while Echo is off; disabling the mod hides presentation and stops affinity without deleting data.

PNG artwork lives in the game's global `data/echoes/art` folder; save records hold bounded IDs rather than filesystem paths. Native single-playthrough export does not include that folder. Back up the whole data directory to preserve artwork. Missing files fall back to a sigil; unreferenced images are retained. Local generation also retains raw sources in ComfyUI's `output/echo_sources` folder.

Shared `echo*.ts` modules own normalization, naming, aspects, setup and stage rules. Renderer hooks apply affinity and integrate setup, galleries and scene presentation. Native services isolate API generation, ComfyUI and segmentation. Cancellation and playthrough checks discard stale results. Tests cover these boundaries, aspect locking, setup/carry, artwork identity, prompt text, stage normalization and the ordinary Breakthrough fallback. No personal saves, generated artwork, credentials or model weights belong in this source change.
