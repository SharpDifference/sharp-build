import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import { charKeyOf, READER_SPEAKER, type SceneGift, type SceneLine } from '@shared/types'
import { character, sceneLines, stubApi } from './fixtures'

/**
 * A mod's lines on the scene: its transient ones are taken back by it alone, wherever they have
 * got to, with every count along the transcript kept true, and no capture of the scene, and so
 * no save, ever holds one.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The kit entry loads the stores, which read the bridge stubbed above, so it loads after it.
const kit = await import('@vx/modkit/renderer')
const { sceneWithout, useGameStore } = await import('../src/renderer/stores/gameStore')
const { registerLoopHooks } = await import('../src/renderer/stores/loop/hooks')
const { resetLoopState } = await import('../src/renderer/stores/loop/state')
const { queuedScene } = await import('../src/renderer/stores/loop/saves')
const { slotReplayOf } = await import('../src/renderer/stores/loop/replay')

function def(id: string, extra: Partial<ModDef> = {}): ModDef {
  return { id, name: id, author: 'test', version: '1.0.0', scope: 'anytime', defaultOn: true, blurb: '', ...extra }
}

beforeAll(() => installMods([def('line-table'), def('line-other'), def('line-off', { defaultOn: false })]))

const sarah = character()
const sarahKey = charKeyOf(sarah.firstName, sarah.lastName)

/** A scene under way: the reader has acted, and the scene's own reply has been read. */
function sceneUnderWay(): void {
  const opening = [{ speaker: READER_SPEAKER, text: 'I sit down.' }, ...sceneLines('The table is set.')]
  useGameStore.setState({
    characters: { [sarah.charId]: sarah },
    cast: [sarah.charId],
    currentSceneTranscript: opening,
    sceneLog: opening,
    pendingLines: [],
    currentLine: opening[1],
    awaitingInput: true
  })
}

/** Plays every queued line onto the log, as the reader reading them would. */
function readAll(): void {
  const { pendingLines, sceneLog } = useGameStore.getState()
  useGameStore.setState({ sceneLog: [...sceneLog, ...pendingLines], currentLine: pendingLines.at(-1) ?? null, pendingLines: [] })
}

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  registerLoopHooks({
    advance: vi.fn(),
    runEnding: vi.fn(async () => {}),
    fetchEndingOpening: vi.fn(async () => null),
    dispatchTurn: vi.fn(),
    prefetchTextLedger: vi.fn(),
    claimTextLedger: vi.fn(async () => ({}))
  })
  sceneUnderWay()
})

describe('sayInScene', () => {
  it("puts a girl's line on the transcript and the box, in her face and her outfit", () => {
    useGameStore.setState({ emotions: { [sarah.charId]: 'neutral_swim' } })

    expect(kit.sayInScene('line-table', ' Your move. ', { charId: sarah.charId, expression: 'happy' })).toBe(true)

    const line = { speaker: sarahKey, text: 'Your move.', actions: [`sprite:${sarahKey},happy_swim`] }
    const game = useGameStore.getState()
    expect(game.currentSceneTranscript.at(-1)).toEqual(line)
    expect(game.pendingLines).toEqual([line])
    expect(game.awaitingInput).toBe(false)
  })

  it.each([
    ['the mod is off', () => kit.sayInScene('line-off', 'A card turns.')],
    ['the words are empty', () => kit.sayInScene('line-table', '  ')],
    ['she is not in the scene', () => kit.sayInScene('line-table', 'Hi.', { charId: 'char-2' })],
    ['the scene is ending', () => (useGameStore.setState({ sceneEnding: true }), kit.sayInScene('line-table', 'A card turns.'))]
  ])('says nothing where %s', (_why, say) => {
    const before = useGameStore.getState().currentSceneTranscript

    expect(say()).toBe(false)
    expect(useGameStore.getState().currentSceneTranscript).toBe(before)
    expect(useGameStore.getState().pendingLines).toEqual([])
  })
})

describe('reachTurn', () => {
  it('refuses during the ending, leaving it running', () => {
    useGameStore.setState({ sceneEnding: true, busy: true, awaitingInput: false })

    expect(kit.reachTurn()).toBe(false)
    expect(useGameStore.getState().sceneEnding).toBe(true)
  })
})

describe('transient lines', () => {
  it("takes back one mod's lines alone, read or still queued, and keeps the summary marks on their lines", () => {
    kit.sayInScene('line-table', 'She turns the queen.', { transient: true })
    kit.sayInScene('line-other', 'The bell rings.', { transient: true })
    readAll()
    useGameStore.getState().setSceneSummary('They sat down to cards.', 4)
    kit.sayInScene('line-table', 'You draw a two.', { transient: true })
    kit.sayInScene('line-table', 'She wins the hand.')

    kit.dropTransientLines('line-table')

    const game = useGameStore.getState()
    const texts = (lines: readonly SceneLine[]): string[] => lines.map((line) => line.text)
    expect(texts(game.currentSceneTranscript)).toEqual(['I sit down.', 'The table is set.', 'The bell rings.', 'She wins the hand.'])
    expect(texts(game.sceneLog)).toEqual(['I sit down.', 'The table is set.', 'The bell rings.'])
    expect(texts(game.pendingLines)).toEqual(['She wins the hand.'])
    // The mark covered the first four lines; one of them is gone, so it covers three.
    expect(game.sceneSummaries.map((mark) => mark.at)).toEqual([3])
  })

  it('lands the box on the last line kept when the line it shows is taken back', () => {
    kit.sayInScene('line-table', 'She turns the queen.', { transient: true })
    readAll()
    const before = useGameStore.getState().lineRewound

    kit.dropTransientLines('line-table')

    expect(useGameStore.getState().currentLine?.text).toBe('The table is set.')
    expect(useGameStore.getState().lineRewound).toBe(before + 1)
  })

  it('keeps a gift on its action when lines before it are taken back, live and through a save', () => {
    kit.sayInScene('line-table', 'She turns the queen.', { transient: true })
    kit.sayInScene('line-table', 'You draw a two.', { transient: true })
    readAll()
    const rose: SceneGift = { charId: sarah.charId, itemId: 'rose', repeat: false, reaction: 'liked' }
    const game = useGameStore.getState()
    useGameStore.setState({ sceneGifts: [{ ...rose, at: game.currentSceneTranscript.length }, rose] })
    game.logPlayerAction('I give her a rose.', true)

    const scene = useGameStore.getState().captureScene()
    expect(scene?.gifts?.map((gift) => gift.at)).toEqual([2, undefined])
    expect(scene?.transcript[2]?.text).toBe('I give her a rose.')

    kit.dropTransientLines('line-table')
    expect(useGameStore.getState().sceneGifts.map((gift) => gift.at)).toEqual([2, undefined])
    // A cut to what was read keeps the action, so it keeps the gift too, live and once reloaded.
    useGameStore.getState().truncateUnread()
    expect(useGameStore.getState().sceneGifts).toHaveLength(2)
    useGameStore.getState().restoreScene(scene)
    useGameStore.getState().truncateUnread()
    expect(useGameStore.getState().sceneGifts).toHaveLength(2)
  })

  it('leaves them out of a capture of the scene, and the box shows the last line kept', () => {
    kit.sayInScene('line-table', 'You both draw.')
    kit.sayInScene('line-table', 'She turns the queen.', { transient: true })
    readAll()

    const scene = useGameStore.getState().captureScene()

    const texts = (lines: readonly SceneLine[] | undefined): string[] => (lines ?? []).map((line) => line.text)
    expect(texts(scene?.transcript)).toEqual(['I sit down.', 'The table is set.', 'You both draw.'])
    expect(texts(scene?.sceneLog)).toEqual(['I sit down.', 'The table is set.', 'You both draw.'])
    expect(scene?.currentLine?.text).toBe('You both draw.')
    // The scene being played still has it, for its mod to take back.
    expect(useGameStore.getState().currentSceneTranscript).toHaveLength(4)
  })

  it('leaves them out of the reply save and the replay, with a gift on its action once reloaded', () => {
    kit.sayInScene('line-table', 'She turns the queen.', { transient: true })
    kit.sayInScene('line-table', 'You draw a two.', { transient: true })
    readAll()
    const game = useGameStore.getState()
    useGameStore.setState({
      sceneGifts: [{ charId: sarah.charId, itemId: 'rose', repeat: false, reaction: 'liked', at: game.currentSceneTranscript.length }]
    })
    game.logPlayerAction('I give her a rose.', true)
    const base = useGameStore.getState().captureScene()
    const reply = sceneLines('She smiles.')
    useGameStore.getState().appendSceneLines(reply)
    const replay = slotReplayOf(0, 0)

    // Through JSON, as the save bridge carries it, so no line keeps its identity.
    const saved = JSON.parse(JSON.stringify(queuedScene(base, reply)))
    useGameStore.getState().restoreScene(saved)
    kit.dropTransientLines('line-table')

    const texts = (lines: readonly SceneLine[] | undefined): string[] => (lines ?? []).map((line) => line.text)
    const kept = ['I sit down.', 'The table is set.', 'I give her a rose.', 'She smiles.']
    const after = useGameStore.getState()
    expect(texts(after.currentSceneTranscript)).toEqual(kept)
    expect(after.sceneGifts.map((gift) => gift.at)).toEqual([2])
    expect(texts(replay?.transcript)).toEqual(kept)
  })

  it('counts off a rewound line taken out, so reading forward again stops where the queue does', () => {
    const [kept, gone, unread] = sceneLines('kept', 'gone', 'unread')
    const records = {
      currentSceneTranscript: [kept, gone, unread],
      sceneLog: [kept, gone],
      pendingLines: [unread],
      currentLine: gone,
      sceneSummaries: [{ summary: 'before', at: 1 }, { summary: 'after', at: 3 }],
      sceneGifts: [],
      endingEditAt: 2,
      reread: 1
    }

    const cut = sceneWithout({ ...records, pendingLines: [gone, unread], reread: 2 }, (line) => line === gone)

    expect(cut?.reread).toBe(1)
    expect(cut?.sceneSummaries.map((mark) => mark.at)).toEqual([1, 2])
    expect(cut?.endingEditAt).toBe(1)
    expect(cut?.currentLine).toBe(kept)
    expect(sceneWithout(records, () => false)).toBeNull()
  })
})
