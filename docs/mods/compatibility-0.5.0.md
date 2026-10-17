# Maestro Leeds mods: 0.5.0 compatibility audit

Audit date: 2026-10-17. Scope: the 12 mods whose registered author is **Maestro Leeds** in `venus-extracurriculars/build`, against Venus University 0.5.0. This is a source, regression-test, synthetic-save and browser-component audit. It does not certify every AI response, provider configuration or historical save.

The shared `main` includes the native New Game+ setup correction from [PR #69](https://github.com/venus-extracurriculars/build/pull/69), merged as `bf32acf`. That correction preserves returning characters' Echoes and Dynamics, lets newcomers use the enabled setup steps, and resumes saved registration choices without replacing them with current global switches.

## Findings corrected

### The Hare & Quill: semester identity

The newsletter read the older optional `termIndex` field. Native 0.5.0 uses `semesterIndex`, so later semesters were treated as semester zero. A Wednesday already present in the archive could suppress the new semester's issue, and discussion/recall rules could mistake an archived issue for a current one.

`whisperTerm` now prefers the native index and retains the legacy fallback for older integrations. Publication, observations, private discoveries, unread state and recall share that clock. Existing issue text and IDs are retained; the fix does not guess dates for already mislabelled historical entries.

The regression in [whisperDelivery.test.ts](../../test/whisperDelivery.test.ts) first failed with `whisper:0:2` instead of `whisper:1:2`. It now publishes three distinct semester editions, leaves the original archive intact and rejects comments on a prior-semester issue. The mod version is 1.0.1.

### Echo: selected ComfyUI target

Echo's optional local artwork path checked the game-managed Python, Nova checkpoint and LoRA even when the player selected an external ComfyUI server or a different managed checkpoint. It now resolves the native target once and passes that same target to startup and generation. Managed installs still check their Python and Megaten LoRA; checkpoint selection and workflow validation use the native service.

External artwork no longer requires an unrelated managed installation. The local model installer is hidden for external servers, and the service rejects an external-server install request before downloading or writing models. Help text explains manual LoRA installation on the selected server. The graph still uses the Megaten LoRA at 0.7 with a compatible SDXL checkpoint; it does not silently switch to a cloud provider.

Coverage: [echoLocalImage.test.ts](../../test/echoLocalImage.test.ts), [echoModelSetup.test.ts](../../test/echoModelSetup.test.ts), existing cancellation/provider tests, and both managed/external UI branches. Echo remains 0.14.2, the unreleased compatibility revision also used by PR #69.

## Mod-by-mod result

“Passed” means the checks listed here passed, with the limitations below. Only the identified Maestro compatibility paths were changed.

| Mod | Result and checked behavior | Dependency / boundary |
| --- | --- | --- |
| Breakthrough | Passed: spirit settlement, spend/refund, rewind, native reply availability, pending-action fences, moment carry and normal-action UI. | Works without Echo or Story Memory. Echo abilities are optional. |
| Character Dynamics | Passed: original traits, relationship context, earned growth, orientation, persisted registration and native newcomer setup. Existing character detail and earned-growth panels render. | Playthrough selection is retained; returning characters are not reassigned. PR #69 supplies the newcomer correction. |
| City Life locations | Passed: catalog gating, enrollment haunts, location occupancy, map options and native schedules. | Uses the enrolled playthrough's selection and current roster. Empty venues do not become clickable NPC destinations. |
| City Life jobs | Passed: player/NPC job catalog, requirements, pay/shifts, enrollment and jobs-board entries for all three venues. | Requires City Life locations. Existing playthrough selection remains authoritative. |
| Custom soundtracks | Passed: cue routing, replacement loops, original-track fallback, previews, switch changes, cancelled loads, persistence and backup validation. Loop control changes persisted in the synthetic UI bridge. | Global library; no Story Memory requirement. No real audio files were imported during the UI audit. |
| Echo | Passed after target-routing correction: identity/setup, affinity, staging, optional abilities, save-dismissal races, cancellation and desktop/browser art storage. | Optional local artwork needs the configured ComfyUI server, compatible models and required nodes. Actual GPU rendering was not run. |
| Breaking Through the Silence | Passed: activation gates, private context, question preparation, dungeon lifecycle, rewind, earned growth, artwork storage and modal controls. | Requires Breakthrough. Echo supplies optional visual/ability features. Active private encounters reset at a semester boundary; earned Dynamics growth remains. |
| Story Memory | Passed: bounded recall, SQLite cache, branch/load replacement, corrections, native character notes coexistence, prompt isolation and spring/fall carry. Fact list and inspector render. | Save data remains authoritative; SQLite is a rebuildable local index. Works without Breakthrough. |
| Plot Twist | Passed: bounded prompt injection, write fencing, native carry and editor display. | Independent; changes guide future generation rather than directly altering game mechanics. |
| Text Regeneration | Passed: whole reply batches beyond three messages, checkpoint reconstruction, stale/load cancellation, hangout/photo safeguards and persisted replacement. | Latest eligible reply only. The UI recognizes a four-message batch. It does not regenerate old-semester or in-progress replies. |
| Meanwhile conversations | Passed: two-character events, private-context isolation, cached playback, archived participant names, season-aware dates and carry. Previous/Next controls advance saved lines. | Spectator conversations do not become player knowledge in Story Memory. Cached playback makes no AI call. |
| The Hare & Quill | Passed after native-semester correction: publication, witnesses, private identity, replies, recall, archives and current/prior edition display. | Independent; prior semesters remain readable archives with closed discussion. |

## Cross-mod save test

[maestroNativeSemesters.test.ts](../../test/maestroNativeSemesters.test.ts) uses the actual native semester builder, carry registry, schema validation and game-store load path. Its synthetic playthrough crosses spring → fall → spring, with every mod's global switch disabled before carrying.

It checks that the playthrough selections, Echo identity and spent aspect change, Dynamics growth, Plot Twist, Breakthrough meters/moments, manually added memory, scene recap, Meanwhile cache and newsletter archive survive. Dates shift by the correct seasonal intervals; archived records retain their original semester/day labels; recaps do not duplicate; a graduating student becomes an alumnus; private spectator dialogue does not enter player recall.

## Validation

Final results with the merged PR #69 included: all three TypeScript checks passed; 253 test files passed with 3,172 passing tests and one pre-existing skip; desktop and web production builds both passed. The browser checks below also passed without uncaught page errors. Reproduce with:

```sh
npm ci
npm run typecheck
npm test -- --maxWorkers=4 --testTimeout=15000
npm run build
npm run build:web
```

The full suite includes the mod-specific tests plus native game tests, allowing it to catch interference outside a mod's own file. The one pre-existing skipped test is reported separately rather than counted as passing.

A temporary browser harness mounted the actual components with synthetic stores and mocked persistence: the mod menu plus 12 feature screens, each in day and night palettes at 1600×1000. It exercised the normal Breakthrough form, Dynamics detail, three City Life employers, soundtrack loop switch, Meanwhile playback, old/current newsletter editions, a four-message regeneration target and the Unheard Soul editor. The Echo managed-installer branch was also checked at 1280×720. These checks made no AI calls and used no personal saves. The temporary harness is not part of the production build.

## Limits and remaining real-play checks

- Cloud text/image endpoints, actual external ComfyUI installation and GPU model execution were not contacted. Their configuration, availability, HTTP errors and output quality require a real provider test. Automated tests cover dispatch, cancellation and failure handling with controlled responses.
- Browser component checks are not a full Electron gameplay session, a complete semester played manually, or a guarantee for every display size.
- Old save data already incorrectly stamped by a previous newsletter version is preserved rather than silently rewritten. New activity uses the native semester clock.
- This audit covers the shared build's Maestro mods. It does not claim compatibility for another author's mod or for the separate Venus Phone application.
