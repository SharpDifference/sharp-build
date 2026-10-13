# Reckoning

Reckoning is an optional three-round encounter in which the reader challenges a student's limiting beliefs. Three successful answers earn a unique Character Dynamics growth tag. The feature is fictional character development, not a clinical assessment; the text model judges the exchange and its consistency needs playtesting.

## Eligibility and flow

Enable Reckoning and Breakthrough. During an open scene reply, a known, present student needs **38 native affection points and 100 spirit**, with no existing Reckoning growth tag. This is approximately 75% of the native 50-point Devoted threshold, rounded up; affection itself has no numerical maximum. Lover status is neither required nor a bypass. Replays and created scenes cannot start encounters.

**Face the reflection** generates the first thought directly, without an introductory screen. The prompt uses her personality, backstory, relevant shared history and current scene to request three distinct beliefs. Opening generation or validation failure spends no spirit. A valid encounter is saved together with its 100-spirit charge before the player answers.

Each reply is judged against the current thought. The first two successes show a separate resolved-thought screen with reaction and feedback; Continue advances without another model request or spirit charge. The third success grants growth. A failed answer ends the attempt without partial rewards; spent spirit is not restored for a valid failed attempt. Provider or disk errors offer retry rather than counting as a bad answer. Pause preserves progress, and Resume does not charge again.

A completed encounter normally uses one opening request, three answer judgments and one scene continuation. The latter runs after closing victory and privately asks for a natural lighter/happier reaction. The student does not learn about the reflection, Echo activation, judgment or reward. The pending continuation survives save/reload and provider errors, then clears after a successful scene response.

## Growth and other mods

The earned tag records this student's particular limiting belief and a more constructive response. It appears in Character Dynamics and nudges future scene, text and slot-opening prompts. It softens that pattern while preserving personality, memories, boundaries and agency; it does not replace the character library or erase every negative trait. One completed tag per student is supported.

Reckoning requires Breakthrough but can operate with Echo or Character Dynamics switched off. With Echo enabled, the reader silently calls their Echo and its artwork appears as a translucent background behind the encounter. Normal Breakthrough still works independently at 100 spirit, and Echo's lower ability prices do not reduce Reckoning's cost. Disabling Reckoning preserves encounters and earned tags; active Character Dynamics may continue applying previously earned growth.

## Presentation and sound

The student portrait inverts while gold/white text presents each belief. Successful rounds fracture the overlay and reveal more light; victory expands the glass effect and reveals the earned tag. Long text uses bounded smaller sizing and more room, with scrolling as a fallback for unusually long output.

Reader artwork uses the position, size, visibility and float controls in **Echoes → Your Echo → Stage**. Its default is a large left-side figure at 18% visibility. Girls have their own stage and floating controls. Reduced motion disables float, glass/victory motion and glitches.

Optional glitch effects produce brief text color offsets and decorative screen fragments while answering. They never alter the actual question, typed answer or saved data. Effects stop during loading, feedback, errors and results. The default seven-second cycle has alternating short bursts roughly 3–4 seconds apart. The saved toggle is in the reader's Stage settings and **Mods → Reckoning**; there is no encounter-header control.

Bundled **Breakthrough** music loops during questions and **Bloom** plays once on victory. Custom Soundtracks has separate question and victory slots which override these defaults. Returning to ordinary play restores its soundscape. The engine retains a completed one-shot cue until leaving it so unrelated updates do not restart Bloom. Only the two exact community MP3 filenames are allowed through installer/public-export packaging; official music remains excluded. See [asset licensing](../../LICENSE-ASSETS.md).

## Saves, rewinds and source boundaries

Optional `exReckoning` data stores the encounter, validated answers, pending aftermath and bounded conversation anchors. Charging, progress and growth writes are transactional; duplicate requests, stale playthrough results and cancelled dispatches cannot apply a second charge or reward. `modCarry` keeps active encounters, while Character Dynamics carries earned growth. Scene-specific aftermath and rewind anchors do not cross semesters.

Rereading earlier dialogue changes nothing. Submitting a different reply at or before an anchored encounter discards its unfinished progress, earned growth and pending aftermath and refunds 100 spirit once, capped at 100. The next prompt uses the rolled-back state. Branching after the encounter retains it. Other character traits remain untouched. Older prototype encounters without anchors are preserved rather than guessed at; new encounters record the required boundary and transcript digest.

`src/shared/reckoning.ts` owns eligibility, validation, state transitions and rewind rules. Renderer store/prompt modules connect those rules to text jobs, saves and scene continuation. `ReckoningModal` owns transient feedback/results, audio and effects. The shared and renderer mod entries register it; native and browser text bridges support its structured completion request. Tests cover successful/failed rounds, malformed output, retry/refund, saving, carry, branch rollback, ordinary Breakthrough and soundscape behavior. Model judgment quality and balance still require live playtesting.
