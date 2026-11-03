# Round 3 inventory

Inspected core `de051018`, main `24f62ffb`, and Photo desktop move `561664ed`.
The core branch changes no mod source. The two parts are renderer re-exports and narrow readers.

## Photo

| Imports | Actual use | Replacement |
| --- | --- | --- |
| `localPhotoStore`, `photoPost`, `photoSwitchHooks` → settings store | `noNsfwImagesOf(settings)` only; the hook subscribes to the same flag. `localPhotoStore` also passes the settings object to `comfyAvailable`. | `noNsfwImages`, `useNoNsfwImages`; local availability reader below. |
| `localPhotoStore` → setup store | `status` passed to `comfyAvailable` with settings. That native rule uses settings presence, `comfySource`, `comfyDeferred`, `status.comfyReady`, and desktop/web platform; external ComfyUI does not need a ready install. | `canRenderLocalImages` and its subscription; preserve the native rule exactly. |
| `PhotoBubble` → Bunnyboard store | Reactive `viewingCharId` only, as the message attachment's owner. | `viewingThread`, `useViewingThread`, `subscribePhoneView`. |
| `photoComments` → grab bag store | Separate `drawMany` calls for feed handles (keyed by entry.key) and emoji, with the kept comment count. No custom pool, accept filter, hydration or flush access. | `drawFeedHandles(count)`, `drawFeedEmoji(count)`. |
| `PhotoBubble` → Lightbox | `<Lightbox src={shot} onClose={...}/>` in the phone overlay. | Renderer `Lightbox`, unchanged component and CSS adopted from main into core. Neither file belongs to a mod in the ownership map. |
| Renderer entry, `photoGroup` → `PHOTO_FEATURE` | The mod's own id for hook registration, post-comment ownership and file carry. | Local `const PHOTO_FEATURE = 'photo-feature'`; no kit export. |
| Shared entry → image-prompt drafts | Registers body additions and regeneration behavior at shared-catalog load, needed by both renderer editor drafts and main renders. | The API and types already exist. Defer registration until after catalog initialization in **both** renderer and main; see below. |
| `ContactGallery` → EchoPanel | Echo's panel at the bottom of Photo's gallery, only for a contact with Echo on; passes `hidden={false}`, `gallery`, `owner={charId}`, and `theme`. | Excluded. Cross-mod gallery composition needs a separately designed slot. |

## Bunnyfeeds

| Imports | Actual use | Replacement |
| --- | --- | --- |
| `bunnyfeedsReplies`, `bunnyfeedsThreads` → grab bag store | Same handle and emoji bags as Photo. Replies draw N of each. Threads may draw one handle or one emoji independently while keeping an existing identity. No accept filter, custom pool, hydration or flush access. | Separate `drawFeedHandles` and `drawFeedEmoji` avoid spending an unused handle or face. These commands consume the game's persistent bags; they are not snapshots. |
| Renderer entry, `BunnyfeedsThread` → Bunnyboard store | Both subscribe only to `open` transitions: phone close batches comment replies and clears the open post. Neither reads `viewingCharId` or writes the phone. | `phoneOpen`, `subscribePhoneView`; callers keep the previous boolean. |
| `bunnyfeedsMemory` → mods store | `modIsOn` is already from the kit. The remaining store access is `switches` passed to `optionOn(..., 'announce')` in ordinary functions, not React components. | New non-hook renderer `modOptionOn`. Existing `useModOption` remains the component API; `modIsOn` does not read an option. |
| `BunnyfeedsThread` → hooks | `sentText()?.bare?.(comment.text)` in `CommentRow`. | Existing `useBareMessage(comment.text)`, called unconditionally at the component's top level, and existing `SentText`. Do not expose the internal owner selector. |
| Prompt → relationship/scene prompts | `relationshipLines` with character, flags, name-known, affection, progress, stats, texting/texted and mood context; `profileLines` with character/flags; `memoryLines` with the last three deduplicated memories, text memory and season; `spaced` with a line array. | Unchanged renderer re-exports and relationship input types. |
| Shared Bunnyfeeds → jobs | `globalSlotOf(days, 0)` for carried post/reply dates. | Already exported from kit/shared. |

## Catalog cycle

Changing only Photo's shared-entry import to `@vx/modkit/shared` works when the catalog loads
first, but a fresh kit-first import fails with `TypeError: registerImagePromptDraft is not a
function`. The eager mod catalog is still importing the kit that is importing the catalog.

Keep the shared definition pure and expose a registration function or draft value. Invoke
registration after the catalog has loaded, from Photo's renderer entry and main startup path.
Renderer-only registration is insufficient: native main-process sprite and CG prompts need it
as well. No new registration API or mod-id constant is needed in this core change.

Game-state, save, character and texting access remains outside this proposal. Echo's gallery
slot is the only interface intentionally left for a separate design.
