import { assignEchoes, settleEchoMemories } from '@shared/echo'
import { registerHooks } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
export function ensureEchoes(): void {
  const g = useGameStore.getState()
  if (!g.playthroughId || g.replaying || g.createdScene) return
  const exEcho = assignEchoes(g.exEcho,g.playthroughId,g.characters,`${g.playerFirstName} ${g.playerLastName}`,g.bio)
  if (JSON.stringify(exEcho) !== JSON.stringify(g.exEcho)) useGameStore.setState({ exEcho })
}
registerHooks('echo', {
  gameEntered: ensureEchoes,
  slotSettled: ({ before }) => {
    ensureEchoes()
    const g = useGameStore.getState()
    if (g.replaying || g.createdScene || g.playthroughId !== before.playthroughId || g.loads !== before.loads) return
    useGameStore.setState({ charInfo: settleEchoMemories(g.exEcho,before.charInfo,g.charInfo,before.date) })
  }
})
