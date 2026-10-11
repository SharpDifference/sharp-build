import { MINI_GAMES, MINI_GAMES_LIST } from '@shared/minigames'
import { MiniGamePanel } from '../minigames/MiniGamePanel'
import { MiniGameSeat } from '../minigames/MiniGameSeat'
import { answerOf, withProposal } from '../minigames/proposal'
import { useTableStore } from '../minigames/session'
import { skillOf } from '../minigames/skill'
import { nameOf } from '../minigames/table'
import { registerHooks } from '../mods/hooks'

registerHooks(MINI_GAMES, {
  scenePlay: { Seat: MiniGameSeat, Panel: MiniGamePanel },

  requests: {
    // Only the turn that carries the proposal asks for her answer: its own words are in what
    // the request was built from, so a turn retried or rewound never picks up a stale one.
    scene: (request, ctx) => {
      const { proposal } = useTableStore.getState()
      if (!proposal || !ctx.query.includes(proposal.text)) return request
      const game = MINI_GAMES_LIST.find((entry) => entry.id === proposal.gameId)
      return game ? withProposal(request, game, nameOf(proposal.charId)) : request
    }
  },

  afterSceneReply: ({ reply, cast, ending }) => {
    const table = useTableStore.getState()
    const { proposal } = table
    if (!proposal) return
    table.setProposal(null)
    const { accepted, stake } = answerOf(reply)
    const game = MINI_GAMES_LIST.find((entry) => entry.id === proposal.gameId)
    const character = cast.find((member) => member.charId === proposal.charId)
    // A yes from a scene that then ended, or from a girl who has left, is no game.
    if (!accepted || ending || !game || !character) return
    table.setAgreed({ gameId: game.id, charId: character.charId, stake })
    // Judged while the reader reads her answer, so the table opens with her ready.
    void skillOf(character, game)
  },

  // A turn the reader takes instead lets an agreed game go; his own proposal is not that turn.
  playerActs: () => useTableStore.getState().setAgreed(null),
  gameEntered: () => {
    useTableStore.getState().setProposal(null)
    useTableStore.getState().setAgreed(null)
  }
})
