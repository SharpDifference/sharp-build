# Breaking Through the Silence

This mod connects Breakthrough to a private encounter with a girl's **Unheard Soul**: the guarded, negative expression of thoughts she struggles to voice. The inner world is **The Unspoken**, called the **Unspoken Void** in narration. The code/save/mod ID remains reckoning so existing records and settings stay readable. It requires Breakthrough; Echoes supplies optional artwork, an aspect and a hint, while ordinary Breakthrough still works independently.

## Establish the link, then follow it

During a safe scene reply, select a known, present girl with at least **38 weighted native affection points** and **100 spirit**, then summon the encounter. This is roughly 75% of the native 50-point Devoted threshold; affection itself has no fixed numerical maximum. Only one link can be active, and a girl with completed growth cannot earn it twice.

The link and charge are saved together. A strong, wordless glitch marks activation. Activation inserts a short ordinary scene beat giving both the reader and girl a sharp head pain; she brushes it off as a passing headache. Later scene prompts preserve that physical event while keeping the mental connection private. This replaces the earlier earthquake/hidden-basement-door concept.

Invocation does not teleport the reader. Finish the current scene, then use **Follow her voice** in the nighttime map row beneath the map. The reader closes their eyes and follows her voice inward. The real girl stays on her normal schedule. The private encounter uses a snapshot of her context rather than moving or replacing the real character.

A new link and its background question preparation require a playable night after the current scene. The final daytime scene still qualifies; the final ordinary night and graduation epilogue do not. A previously linked encounter can still be entered on the final playable night. The same relative calendar applies to continuing semesters. A successful link save also updates the held exit checkpoint, so quitting or switching saves during its head-pain beat retains both unread lines and the single spirit charge; failed saves keep the previous checkpoint and spirit.

Each of the 22 original aspects has its own named dark inner world and bundled background. The destination follows the **girl's aspect**, not the reader's. The catalog in shared/reckoningDungeons.ts defines all 22; untyped legacy/no-Echo cases use the validated fallback. There is one map entrance, not 22 physical travel locations.

## Four choices before the questions

The floating four-button menu uses native Venus styling. Hover glitches have no decorative scan lines. Choosing the questions removes this menu and keeps the established three-round question interface.

| Choice | Behavior |
| --- | --- |
| Talk | She opens, then the reader can make three replies. Her responses are personal, dark, moody and unapologetic, with indirect clues rather than quotations from the question set. The fourth reply ends the attempt locally without another paid request. A warning appears after the third. |
| Break through the silence | The button warns that there is no going back to Talk or the hint during this attempt. It opens directly on the first question; no introduction screen. Pausing preserves the questions, not access to the preparation choices. |
| Your named aspect ability | The reader's actual Echo ability supplies one perspective/hint per connection. It needs Echoes and a player aspect, costs no additional spirit, and can be reread without another request. Reentering does not restore the spent hint. |
| Open your eyes | A hard return to the real world, without a goodbye conversation or a flash of the normal portrait. An unfinished link remains available. Failed or expelled attempts need another 100 spirit to enter again. |

Talk is separate from ordinary scenes: its private transcript does not become Story Memory or native relationship memories. A fresh response appears in the Talk panel first, then leads the next glitched whisper and joins the rotation. Starting the questions ends Talk and hint access. Normal Breakthrough and its other aspect actions cannot be used in this location.

## Questions, judgment and reward

Opening questions use bounded personality/backstory, chosen dynamics, native memories and shared history. Generated evidence references are validated, but that cannot prove the model interpreted an event correctly. There are three distinct beliefs. Each reply is judged against its current belief; meaningful imperfect answers can pass. A rejected answer ends the entire attempt, with no partial growth. Provider, parsing and save failures leave progress unchanged for retry; they are not an automatic defeat.

The first two successes display a resolved-thought screen before Continue advances to the next question. Continuing makes no extra model call. The question layout fits long text down to a readable minimum and retains scrolling for exceptional content/window sizes. Three successes grant a unique saved Character Dynamics growth tag that softens the specific limiting beliefs without replacing her personality or promising a cure. The victory screen restores her normal portrait; 128 small irregular shards break and fall, while the Unheard Soul dissolves from the private world.

The real girl does not know about this encounter. A later ordinary scene can express relief or a lighter mood naturally. That follow-up belongs outside the dungeon. The temporary link, private dialogue and whisper state end on completion; the earned growth is the persistent result. Disabling Character Dynamics does not duplicate or lose growth prompts: the Reckoning hook supplies them only when that mod is off for the running playthrough.

## Preparation, whispers and presentation

Prepare questions in the background is on by default. Eligible current-scene targets can prepare their opening set while the panel is closed. Requests are serialized/debounced and invalidated when relevant context, save/provider or eligibility changes. Prepared text alone spends no spirit and writes no save. Background failure requires an explicit retry. Turning this option off restores on-demand preparation. It can consume tokens for unused openings; answer judgments, Talk and the hint remain live requests.

Whispers are always first person and use existing prepared/context text rather than a timed generation loop. They appear at random safe background positions, avoid detected portrait silhouettes and controls, and use approximately 48% opacity. Characters can have different image sizes. Full-screen interference accompanies the letter glitches. With the linked girl present, subsequent whispers occur about every 50–75 seconds; in other scenes, her voice can appear every two minutes even while absent. Inside the dungeon, whispers repeat every ten seconds until the questions start. Hidden, busy, error and unsuitable scene states suppress them.

The girl and her Echo are visible in the private location. The reader's Echo appears when questions begin, large and faint on the left; the girl's Echo is on the right. Question-screen portrait placement is fixed independently of the adjustable dungeon portrait. Escape does not dismiss the location to reveal a normal sprite. Entry uses no speech blips. Glitches, floating and shattering honor reduced motion; the saved glitch switch is shared by Mods and Echoes → Your Echo → Stage. Disabling glitches leaves calm translucent whispers.

## Unheard Soul character artwork

Character management offers a separate Unheard Soul screen for default and custom girls. Its shared top viewport supports full-art and scene preview, with adjustable dungeon X/Y and scale. Download image, Upload image and Restore default share one action row. Generation uses the character as a reference; it never overwrites her ordinary sprites. Restore default returns to the inverted normal portrait.

On desktop, character ZIP export/import/duplicate carries a validated optional exReflection manifest extension containing the image and staging. Whole-game backups carry exReflections. These paths work with the mods off, and older packages without the extension remain accepted. A stock importer can ignore the optional JSON extension and import the ordinary character; that does not preserve the extra artwork through a stock re-export. Browser Echo artwork support exists, but the new Unheard Soul editor/portable extension currently remains desktop-only; the browser uses the inverted default portrait.

## Music

| Phase | Bundled default | Playback |
| --- | --- | --- |
| The Unspoken, before questions | Rise from the Dark | Loop |
| Questions | Breakthrough: Victory & Hope | Loop |
| Victory | Bloom | Once |

Settings → Custom soundtracks exposes independent replacement slots for all three. Music follows the normal Music volume; the separate dungeon-silence toggle was removed. Question music and the reader's Echo begin with the questions, not on entry. Leaving restores the normal soundscape. The [asset notice](echo-asset-licenses.md) credits themaestroai and records permission for all three tracks. The release installer allowlist includes all three files and restores the official installation on uninstall.

## Persistence, rewind and isolation

exReckoning stores the active link, bounded private visit and question progress. Spirit/progress/growth writes use the native save queue and check request ownership before applying a late result. Provider/save errors cannot silently double-charge or award a partial tag. Load/retry/resume preserves the relevant attempt. Legacy records remain normalized instead of being guessed at or discarded.

Reading old dialogue is harmless. Submitting a new reply at or before a recorded encounter anchor rolls back that branch's encounter/growth and refunds the recorded charge once, up to the spirit cap. Branching after it retains the encounter. Older records without an anchor are preserved. Blocked follow-up scene prompts support the normal edit-and-retry flow.

The dungeon does not call native scene settlement or Story Memory extraction. Its ordinary Talk, questions, hints and whispers do not become public conversation history. The ordinary link-establishment sensation and later relief can be part of real-world story continuity; the private mechanics must not leak into characters' knowledge. Continuing Semesters resets transient encounters and carries earned dynamics through the existing registry.

## Source map and validation

| Area | Main files |
| --- | --- |
| State, catalogs and validation | shared/reckoning, reckoningDungeonState, reckoningDungeons, dungeonConversation, reckoningVoice, unspokenVoice |
| Lifecycle and persistence | renderer/stores/reckoning, reckoningDungeon, loop/saves, loop/turn, gameLoop |
| Bounded model context | renderer/prompts/reckoningPrompt, shared/dungeonConversation, renderer/prompts/characterDynamics |
| Visuals and placement | ReckoningDungeon, ReckoningModal, UnspokenVoice, UnspokenLinkGlitch, ReflectionPortrait, FallingGlass, whisperLayout, whisperSilhouette |
| Character images and portability | main/services/echoService, reflectionStorage, characterTransferService, backupService |
| Audio | shared/audio, shared/soundtracks, renderer/stores/audioEngine, audioStore, soundscape |

See [current validation](echo-validation.md), [Echoes](echo.md), [abilities](echo-breakthrough.md) and [Custom soundtracks](custom-soundtracks.md). This remains a draft feature for source review and broader live-model/balance/release testing; simulated responses do not establish narrative quality.

## October 14 preparation and voice follow-up

Prepared questions, including an outstanding request, survive committing the link that opens The Unspoken. A failed link save retains preparation and does not spend spirit; loading a different save or changing provider/context still invalidates it. First-person whisper validation no longer rejects ordinary words just because they match the owner's name (for example, May or Hope); explicit third-person narration remains excluded. Six additional lifecycle controls verify answer cancellation, load/reset, final-growth delays, failed saving and commit ownership. See the combined third/fourth-pass QA report after integration with #57.


## Fifth-pass persistence and context checks

Prepared questions and new Unspoken snapshots use Character Dynamics starting choices only when enabled in the running playthrough record. Changing the menu switch for future games does not change that decision. Carried choices remain saved while inactive; earned growth and its completion guard remain independent. Existing paid encounter snapshots remain stable.
