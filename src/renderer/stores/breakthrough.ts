import { BREAKTHROUGH_MOD, SPIRIT_MAX, breakthroughSpent, refundSpirit, normalizeBreakthrough, outcomeOf, settleBreakthrough, type BreakthroughPending } from '@shared/breakthrough'
import { fullNameOf, type Character, type SceneLine, type StructuredRequest } from '@shared/types'
import { breakthroughAdvantage } from '../prompts/breakthroughPrompt'
import { echoBreakthroughPrompt } from '../prompts/echoBreakthroughPrompt'
import { echoBreakthroughAbility, ECHO_BREAKTHROUGH_OPTION, type EchoBreakthroughAspect } from '@shared/echoBreakthrough'
import { optionOn } from '@shared/mods'
import { useGameStore } from './gameStore'
import { modIsOn, useModsStore } from './modsStore'
import { interjectOfferOf, replyRowOfferOf } from './loop/playback'

type Game = ReturnType<typeof useGameStore.getState>

export function availableEchoBreakthrough(game:Game) {
  if(!modIsOn('echo')||!optionOn(useModsStore.getState().switches,'echo',ECHO_BREAKTHROUGH_OPTION))return null
  return echoBreakthroughAbility(game.exEcho.player?.aspect)
}

export function breakthroughCast(game: Game): string[] {
  return game.cast.filter(id => !game.departed.includes(id) && game.characters[id])
}

export function canSpendBreakthrough(game:Game,id:string,cost:number):boolean {
  const offer = interjectOfferOf(game)
  const canReply = offer === 'open' || offer === 'none' && (replyRowOfferOf(game) === 'open' ||
    game.awaitingInput && !game.busy && game.pendingLines.length === 0)
  return (!game.exReckoning.dungeon||game.exReckoning.dungeon.phase==='unlocked') && modIsOn(BREAKTHROUGH_MOD) && !!game.playthroughId && !game.replaying && !game.createdScene && canReply && !game.sceneQuiz &&
    !game.turnError && !game.statusShown && !game.statusModal && !game.activeGameOver &&
    !game.exBreakthrough.pending && breakthroughCast(game).includes(id) &&
    (game.currentSceneTranscript.length > 0 || game.sceneSummary !== null) && (game.exBreakthrough.meters[id] ?? 0) >= cost
}

/** Omitting the aspect always asks for the ordinary 100-spirit action. */
export function canBreakthrough(game:Game,id:string,echoAspect?:EchoBreakthroughAspect):boolean {
  const ability=echoAspect?availableEchoBreakthrough(game):null
  if(echoAspect&&ability?.aspect!==echoAspect)return false
  return canSpendBreakthrough(game,id,ability?.cost??SPIRIT_MAX)
}

/** The native interject function is injected, keeping this module independent of the loop façade. */
export function activateBreakthrough(id: string, direction: string, dispatch: (text: string) => boolean, echoAspect?:EchoBreakthroughAspect): void {
  const game = useGameStore.getState()
  if(echoAspect!==undefined&&availableEchoBreakthrough(game)?.aspect!==echoAspect)throw Error('That Echo ability is not available to your current player Echo.')
  const ability=echoAspect?availableEchoBreakthrough(game)!:null
  const cost=ability?.cost??SPIRIT_MAX
  const action=ability?.action??direction.trim()
  if (!canBreakthrough(game,id,echoAspect)) throw Error(`At least ${cost} spirit and an open reply window with this character are required.`)
  if (!action || action.length > 1000) throw Error('Describe your action and hope in 1–1,000 characters.')
  const state = normalizeBreakthrough(game.exBreakthrough)
  const pending:BreakthroughPending = { id:crypto.randomUUID(), charId:id, direction:action,
    date:game.date, time:game.time, playthroughId:game.playthroughId!,...(echoAspect?{echoAspect,spent:cost}:{}) }
  state.meters[id] = (state.meters[id]??0)-cost
  state.pending = pending
  useGameStore.setState({ exBreakthrough:state })
  try {
    // No await before native interruption: it owns truncation, cancellation and the decision save.
    if (!dispatch(pending.direction)) throw Error('The reply window closed. Your spirit has been returned.')
    useGameStore.setState({ breakthroughFlash:{id:pending.id,playthroughId:pending.playthroughId,
      ...(echoAspect?{echoAspect}:{}),
      name:game.charInfo[id]?.nameKnown ? fullNameOf(game.characters[id]) : 'A shared moment'} })
  } catch (error) {
    finishBreakthrough(pending.id,true)
    throw error
  }
}

/** A token can finish or refund only its own activation, once. */
export function finishBreakthrough(token: string | undefined, refund: boolean, lines: readonly SceneLine[] = [], at = 0): void {
  const game = useGameStore.getState(), state = normalizeBreakthrough(game.exBreakthrough), pending = state.pending
  if (!pending || pending.id !== token || pending.playthroughId !== game.playthroughId) return
  const outcome = outcomeOf(lines)
  if (refund || !outcome) state.meters[pending.charId] = refundSpirit(state.meters[pending.charId]??0,pending)
  else state.moments[pending.charId] = [...(state.moments[pending.charId] ?? []),{
    id:pending.id, date:pending.date, time:pending.time, outcome,
    transcriptStart:at, transcriptCount:lines.length, spent:breakthroughSpent(pending)
  }].slice(-6)
  state.pending = null
  useGameStore.setState({ exBreakthrough:state, ...(refund ? {breakthroughFlash:null} : {}) })
}

/** A manual retry charges the same recorded price after a refund; it never gets a free bonus. */
export function rearmBreakthrough(pending?: BreakthroughPending): void {
  const game = useGameStore.getState()
  if (!pending || pending.playthroughId !== game.playthroughId || pending.date !== game.date || pending.time !== game.time ||
    !canSpendBreakthrough(game,pending.charId,breakthroughSpent(pending))) return
  if(pending.echoAspect&&availableEchoBreakthrough(game)?.aspect!==pending.echoAspect)return
  const state = normalizeBreakthrough(game.exBreakthrough)
  state.meters[pending.charId] = (state.meters[pending.charId]??0)-breakthroughSpent(pending)
  state.pending = {...pending}
  useGameStore.setState({exBreakthrough:state})
}

export function withBreakthrough(request: StructuredRequest, cast: Character[], solo: boolean): StructuredRequest {
  const game = useGameStore.getState(), pending = game.exBreakthrough.pending
  if (!modIsOn(BREAKTHROUGH_MOD)) {
    if (pending) finishBreakthrough(pending.id,true)
    return request
  }
  const blocks = [request.user]
  if (pending) {
    const target = cast.find(c => c.charId === pending.charId)
    if (!target || solo || game.replaying || game.createdScene || pending.playthroughId !== game.playthroughId || pending.date !== game.date || pending.time !== game.time ||
      pending.echoAspect&&availableEchoBreakthrough(game)?.aspect!==pending.echoAspect)
      finishBreakthrough(pending.id,true)
    else blocks.push(pending.echoAspect?echoBreakthroughPrompt(pending,target):breakthroughAdvantage(pending,target))
  }
  return { ...request, user:blocks.join('\n\n') }
}

export function settleSpirit(before: Game): void {
  const game = useGameStore.getState()
  if (!modIsOn(BREAKTHROUGH_MOD) || !before.playthroughId || before.createdScene || before.replaying || game.playthroughId !== before.playthroughId) return
  useGameStore.setState({exBreakthrough:settleBreakthrough(game.exBreakthrough,before.charInfo,game.charInfo,before.date,before.time)})
}
