import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, type MiniGameDef } from '@shared/minigames'
import type { Character } from '@shared/types'
import { MiniGamePanel } from '../minigames/MiniGamePanel'
import { MiniGameSeat } from '../minigames/MiniGameSeat'
import { agreedOf, withOffer } from '../minigames/offer'
import { gameComponent } from '../minigames/play'
import { answerOf, withProposal } from '../minigames/proposal'
import { useTableStore } from '../minigames/session'
import { skillOf } from '../minigames/skill'
import { nameOf } from '../minigames/table'
import { registerHooks } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { modIsOn } from '../stores/modsStore'

/** The games a girl in this scene could be played at, each with a component to play it with. */
function gamesWith(cast: readonly Character[], location: string | null): MiniGameDef[] {
  if (cast.length === 0) return []
  return gamesOffered({ location, girls: cast.length }, (modId) => modIsOn(modId)).filter(
    (game) => game.players.max >= 1 && Boolean(gameComponent(game.id))
  )
}

/** She said yes: the table is hers to sit at once her reply is read, and her skill is judged now. */
function agree(
  game: MiniGameDef,
  character: Character,
  stake: string,
  options: Record<string, number>
): void {
  useTableStore.getState().setAgreed({ gameId: game.id, charId: character.charId, stake, options })
  // Judged while the reader reads her answer, so the table opens with her ready.
  void skillOf(character, game)
}

registerHooks(MINI_GAMES, {
  scenePlay: { Seat: MiniGameSeat, Panel: MiniGamePanel },

  prompts: {
    // What a game just played has to say, on the one turn that reports it.
    scene: {
      lines: (ctx) => {
        const { played } = useTableStore.getState()
        return played && ctx.query.includes(played.text) ? ['', ...played.brief, ''] : []
      }
    }
  },

  requests: {
    scene: (request, ctx) => {
      // The turn that carries the reader's own proposal asks for her answer to it and nothing
      // else: its words are in what the request was built from, so a turn retried or rewound
      // never picks up a stale one.
      const { proposal } = useTableStore.getState()
      if (proposal && ctx.query.includes(proposal.text)) {
        const game = MINI_GAMES_LIST.find((entry) => entry.id === proposal.gameId)
        return game ? withProposal(request, game, nameOf(proposal.charId)) : request
      }
      // Every other turn the reader takes with a girl carries the standing offer. A scene's
      // closing is not one: it has no action of his, and nothing more is going to be played.
      if (!request.user.includes("Reader's action:")) return request
      const location = ctx.state.sceneLocation ?? null
      const games = gamesWith(ctx.cast, location)
      if (games.length === 0) return request
      const scene = useGameStore.getState()
      const busy = Boolean(scene.sceneClass || scene.sceneJob || scene.sceneProject)
      return withOffer(request, games, ctx.cast, location, busy)
    }
  },

  afterSceneReply: ({ reply, cast, ending }) => {
    const table = useTableStore.getState()
    table.setPlayed(null)
    const { proposal } = table
    table.setProposal(null)

    if (proposal) {
      const game = MINI_GAMES_LIST.find((entry) => entry.id === proposal.gameId)
      if (!game) return
      const { accepted, stake, options } = answerOf(reply, game)
      const character = cast.find((member) => member.charId === proposal.charId)
      // A yes from a scene that then ended, or from a girl who has left, is no game.
      if (accepted && !ending && character) agree(game, character, stake, options)
      return
    }

    // No proposal of his own was out: the two of them may still have agreed in the scene.
    if (ending) return
    const agreed = agreedOf(reply, gamesWith(cast, useGameStore.getState().sceneLocation), cast)
    if (agreed) agree(agreed.game, agreed.character, agreed.stake, agreed.options)
  },

  // A turn the reader takes instead lets an agreed game go; his own proposal is not that turn.
  playerActs: () => useTableStore.getState().setAgreed(null),
  // Nothing in hand belongs to the game being entered. Its scene is not loaded yet, so whether
  // she had just agreed at the point it stands on is asked later, by the seat, at the reader's turn.
  gameEntered: () => {
    useTableStore.getState().setProposal(null)
    useTableStore.getState().dropAgreed()
    useTableStore.getState().setPlayed(null)
  }
})

// In development a change to this file, or to anything it imports that is not a component, runs
// it again, and registering again stacks a second seat and a second set of hooks on the first.
// The page is reloaded instead, so there is only ever the one registration.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
