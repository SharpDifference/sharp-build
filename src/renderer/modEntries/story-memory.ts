import { acceptStoryFacts, recallPayload, STORY_MEMORY_LIGHT_OPTION } from '@shared/storyMemory'
import { optionOn } from '@shared/mods'
import { useModsStore } from '../stores/modsStore'
import { withNativeStoryRecall, withStoryExtraction } from '../prompts/storyMemoryPrompt'
import { currentStorySnapshot } from '../stores/storyMemory'
import { useGameStore } from '../stores/gameStore'
import { registerHooks } from '../mods/hooks'

registerHooks('story-memory', {
  requests: {
    scene: (request, { cast, state, query }) => withNativeStoryRecall(
      request, state.storyMemory, cast.map(c => c.charId), query, state.calendar.season),
    dm: (request, { character, state, newMessage }) => withNativeStoryRecall(
      request, state.storyMemory ?? currentStorySnapshot(), [character.charId], newMessage, state.calendar.season),
    ledger: (request, { state, charKeys }) => withStoryExtraction(request, state.storyMemory, charKeys, {
      mode: optionOn(useModsStore.getState().switches, 'story-memory', STORY_MEMORY_LIGHT_OPTION) ? 'light' : 'standard',
      cast: charKeys.flatMap(key => {
        const id = useGameStore.getState().charKeyToId[key]
        return id ? [id] : []
      })
    }),
    'slot-intro': (request, { input }) => {
      const dm = [...new Set([...input.askers, ...input.breakups].map(person => person.character.charId))]
      const posts = [...new Set(input.posters.map(person => person.character.charId))]
      const payload = recallPayload(input.storyMemory, [...dm, ...posts], input.recent.join(' '))
      if (payload.storyMemory) payload.storyMemory.slotAuthors = { dm, posts }
      return { ...request, ...payload }
    }
  },
  slotSettled: ({ before, ledger, closingCast }) => {
    if (!before.playthroughId || before.createdScene || before.replaying) return
    const live = useGameStore.getState()
    useGameStore.setState({ exStoryMemory: acceptStoryFacts(live.exStoryMemory, ledger?.exStoryFacts, {
      date: before.date, time: before.time,
      cast: [...new Set([...before.cast, ...closingCast.map(c => c.charId)])],
      charKeyToId: before.charKeyToId,
      transcript: [...live.sceneLog, ...live.pendingLines, ...live.currentSceneTranscript]
    }) })
  }
})
