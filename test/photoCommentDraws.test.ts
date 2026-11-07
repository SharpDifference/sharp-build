import './fixtures/maestroModelKit'
import { afterEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useGrabBagStore } from '../src/renderer/stores/grabBagStore'
import { FEED_EMOJI_BAG, FEED_HANDLE_BAG } from '../src/renderer/prompts/feedRandoms'
import { setPhotoSwitches } from '../src/shared/photoSwitches'
import { rollComments } from '../src/renderer/stores/photoComments'

afterEach(() => {
  vi.restoreAllMocks()
  restoreApi()
})

it('draws a handle then a face for every kept comment, in the written order', () => {
  stubApi({ jobs: { onProgress: () => () => {} } })
  setPhotoSwitches({ on: true })
  useGameStore.setState({ playthroughId: 'one', date: 2, time: 0 })
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  const draw = vi.spyOn(useGrabBagStore.getState(), 'drawMany')
  const lines = ['first', 'second', 'third']
  const comments = rollComments('poster', lines, 'suggestive')
  expect(comments.length).toBeGreaterThan(0)
  expect(comments.map(one => one.text)).toEqual(lines.slice(0, comments.length))
  expect(draw.mock.calls.map(([bag, , count]) => [bag, count])).toEqual([
    [FEED_HANDLE_BAG, comments.length],
    [FEED_EMOJI_BAG, comments.length]
  ])
  const handles = draw.mock.results[0].value as { handle: string }[]
  expect(comments.map(one => one.handle)).toEqual(handles.map(one => one.handle))
  expect(comments.map(one => one.emoji)).toEqual(draw.mock.results[1].value)
})
