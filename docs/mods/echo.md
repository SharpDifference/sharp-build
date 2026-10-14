# Echoes

Echoes gives the reader and each student a named symbolic creature and one of 22 original aspects. Matching aspects increase new positive relationship progress by 25%; competing aspects reduce it by 25%. Existing memories and negative gains are unchanged. Aspect assignment is a local profile-cue classifier, not an AI personality assessment. Ability prices and narrative effects remain experimental.

## Setup and customization

The shared Echoes manager appears near the end of new-game setup, after course selection. It starts with aspects, names and creature suggestions drawn from each profile. Before the game begins, the reader and new students can freely change starting aspects, names, creature details, artwork and staging. Returning students retain the history and identity brought forward by Continuing Semesters. Setup does not automatically buy artwork; generation buttons use the configured provider.

During play, open Echoes from its scene sidebar icon between Calendar and Settings, or the corner controls between scenes. Only met students appear in the manager, gallery and batch-generation list. Unmet students keep their assigned identities privately until introduced. Existing playthroughs do not repeat enrollment.

After starting, students' aspects are locked and the reader has one aspect change. Names and visual creature descriptions remain editable for everyone. The name and creature dice generate local suggestions for free. Save changes before generating artwork: the chosen name, species and description shape its appearance. Regenerating artwork preserves the saved name and aspect. Why this type? is marked as a spoiler and explains the relevant backstory/personality cues, including weak-evidence cases.

The manager uses the game's typography, paper-shadow buttons and day/night palette. New-game setup always uses a plain light background. The artwork gallery has a separate Echoes section.

## Artwork providers and transparency

Gemini or the configured image API is the default. Mods → Echo → Local Megaten artwork selects an optional Echo-only ComfyUI workflow. A LoRA cannot be attached to the Gemini API: it is used only by that local workflow. Other image features keep their own provider settings. Only the reader's missing artwork gets an automatic first-menu attempt; student generation is explicit. Upload accepts existing artwork and Download exports the finished PNG.

Desktop and browser API generation use local ISNet subject segmentation through IMG.LY background-removal 1.7.0 and ONNX Runtime Web 1.21.0. Gemini does not require ComfyUI or Python. First use downloads roughly 100 MB of model/runtime resources from the pinned resource host; later requests can reuse the cache. Images are not uploaded to that host. Initialization completes before a paid image request. Generated originals are retained before segmentation so a failed cutout does not discard the paid source. White-edge refinement is restricted to suitable light backgrounds instead of deleting dark body pixels.

The desktop runs segmentation in a hidden sandboxed renderer without a preload/filesystem bridge. Cancellation closes its worker/window. Browser custom endpoints must permit CORS. Provider, network and cache availability still affect generation; transparency quality is not guaranteed for every image.

Generation reserves its cancellable job before reading settings, on desktop and browser. Stop/Close during that read or preparation prevents a provider request; a second job is refused until the first settles. Desktop cancellation also checks the requesting window's ownership. A request already sent to the provider may still be chargeable. The bundled software notices and model license open as read-only in-game dialogs, including offline, without permitting arbitrary file links.

Whole-game backups include all retained finished Echo artwork, including images used by historical saves. There is no separate 4,096-image manifest cutoff; combined collections can be exported and restored subject to the existing whole-archive import limits (16,384 entries, 8 GiB) and per-image validation. This change does not delete old images or recovery originals. Recovery originals remain local and outside backups.

The optional local workflow uses ComfyUI with novaAnimeXL_ilV190.safetensors and Megaten_Style.safetensors. Set up local artwork → Install local art models explicitly downloads missing originals (about 6.9 GB and 218 MB), checks pinned sizes and hashes, reuses matching files and refuses to overwrite a different version. Downloads can be cancelled; manual installation remains available. LoRA strength is 0.7 with the workflow's SDXL encoder configuration. Weights are not bundled in Git. See the [separate asset notices](echo-asset-licenses.md).

## Staging and abilities

Each owner has X/Y, scale, optional visibility override, floating motion and speed controls. Save placement applies the preview; closing an unsaved draft leaves the scene unchanged. Visibility is opacity, not background removal: it fades the entire already-cut-out creature. Shared visibility defaults to 30%; per-owner values and Hide on stage take priority. Floating cycles range from 3–20 seconds and respect reduced motion.

During Breaking Through the Silence, the reader's Echo defaults to a large, faint left backdrop (X 25, Y 600, scale 2.39, 18% visibility). Saved overrides win. The girl's Echo appears opposite it, mirrored from the reader's placement. Her dungeon portrait controls do not move the question-screen portrait. The reader's Stage panel also exposes the saved glitch-effects option; it remains accessible through Mods when Echoes is disabled.

Every aspect has a one-exchange ability costing 25, 50 or 75 spirit. Activations use a fixed action with no free-text ability box. Normal Breakthrough retains its custom action and 100-spirit cost, and works with Echoes disabled. See the complete [ability catalog and pricing](echo-breakthrough.md). These effects guide the scene model; they do not guarantee success, force relationship points, or remove character boundaries.

## Saves, backups and source map

Echo identity, locks, staging and affinity markers are validated in the exEcho save extension. Continuing Semesters carries them through modCarry; turning the mod off preserves the data. Whole-game desktop/browser backups include finished Echo artwork and reject conflicting immutable image IDs. Loose save JSON does not embed image bytes or recovery originals. This tree has no separate single-playthrough export.

Unheard Soul artwork is a separate character image, not an Echo replacement. Its desktop character export/import/duplicate and whole-game backup support are described in [Breaking Through the Silence](reckoning.md). The browser supports ordinary Echo artwork but currently uses the inverted normal portrait for Unheard Souls; their custom image editor and portable extension are desktop-only.

| Source | Responsibility |
| --- | --- |
| shared/echoAspects, echoReasons, echoNaming, echo, echoStage, echoSetup | Catalog, profile defaults, validation, naming, placement and enrollment rules |
| shared/modEntries/echo and renderer/modEntries/echo | Discovery, settings, lifecycle and semester carry |
| renderer/views/EchoPanel and NewGameView | Shared manager, gallery/stage and late enrollment step |
| main/services/echoService, echoCutout and renderer/art/echoCutout | Desktop generation, storage and isolated segmentation |
| web/echoArtwork | Browser artwork and provider adapter |
| shared/echoBreakthrough and renderer/prompts/echoBreakthroughPrompt | Exhaustive abilities and bounded one-turn instructions |

Current validation and remaining release checks are in [echo-validation.md](echo-validation.md). The internal IDs remain echo and reckoning for compatibility with existing saves and settings.


## Fifth-pass persistence and context checks

Closing the Echo manager before Save starts discards the draft. Once storage acknowledges a dispatched Save, the live Echo and next autosave retain that edit even if the manager has closed. A load/reset or different playthrough still blocks stale completion, and failed writes leave live state unchanged.
