import { dynamicFor, type GrowthTag } from '@shared/characterDynamics'
import { anchorReckoning, applyReckoningVerdict, hasReckoningAffection, parseReckoningThoughts, parseReckoningVerdict, RECKONING_AFFECTION_MIN, RECKONING_MOD, type ReckoningSession } from '@shared/reckoning'
import { beginReckoningPrompt, answerReckoningPrompt, reckoningContext } from '../prompts/reckoningPrompt'
import { useGameStore } from './gameStore'
import { modIsOn } from './modsStore'
import { canSpendBreakthrough } from './breakthrough'
import { writeReckoningChange } from './loop/saves'
import { loopState } from './loop/state'
type Game=ReturnType<typeof useGameStore.getState>
let flight:{group:string;cancelled:boolean;committing:boolean}|null=null
export function canStartReckoning(game:Game,id:string):boolean {
  const pending=game.exReckoning.aftermath
  return modIsOn(RECKONING_MOD)&&canSpendBreakthrough(game,id,100)&&!game.exReckoning.active&&!(pending&&pending.date===game.date&&pending.time===game.time)&&
    !dynamicFor(game.exCharacterDynamics,id).growth&&hasReckoningAffection(game.charInfo[id],game.date,game.characters[id])
}
export function canResumeReckoning(game:Game,id:string):boolean {
  return modIsOn(RECKONING_MOD)&&canSpendBreakthrough(game,id,0)&&game.exReckoning.active?.charId===id
}
/** A saved private continuation is eligible only in the scene where growth was earned. */
export function canContinueReckoning(game:Game):boolean {
  const after=game.exReckoning.aftermath
  return !!after&&modIsOn(RECKONING_MOD)&&game.awaitingInput&&!game.busy&&canSpendBreakthrough(game,after.charId,0)&&
    after.date===game.date&&after.time===game.time&&dynamicFor(game.exCharacterDynamics,after.charId).growth?.id===after.id
}
export function finishReckoningAftermath(token?:string):void {
  if(!token)return
  const game=useGameStore.getState()
  if(game.exReckoning.aftermath?.id!==token)return
  const {aftermath:_after,...state}=game.exReckoning
  if(loopState.statusBase)loopState.statusBase={...loopState.statusBase,exReckoning:state}
  useGameStore.setState({exReckoning:state})
}
/** An in-flight disk commit finishes before the panel may close. */
export function cancelReckoningRequest():boolean {
  if(flight?.committing)return false
  if(flight){flight.cancelled=true;void window.api.jobs.cancelGroup(flight.group)}
  return true
}
async function operation<T>(run:(group:string,current:()=>boolean,commit:()=>void)=>Promise<T>):Promise<T> {
  if(flight)throw Error('A Reckoning request is already in progress.')
  const game=useGameStore.getState(),job={group:`reckoning-${crypto.randomUUID()}`,cancelled:false,committing:false}
  flight=job
  const current=():boolean=>{const now=useGameStore.getState();return !job.cancelled&&modIsOn(RECKONING_MOD)&&modIsOn('breakthrough')&&
    now.playthroughId===game.playthroughId&&now.loads===game.loads&&now.date===game.date&&now.time===game.time&&now.currentSceneTranscript===game.currentSceneTranscript&&
    now.exCharacterDynamics===game.exCharacterDynamics&&now.exReckoning===game.exReckoning&&
    !now.createdScene&&!now.replaying}
  try{return await run(job.group,current,()=>{job.committing=true})}finally{if(flight===job)flight=null}
}
export async function startReckoning(charId:string):Promise<void> {
  return operation(async(group,current,commit)=>{
    const game=useGameStore.getState()
    if(!canStartReckoning(game,charId))throw Error(`Reach ${RECKONING_AFFECTION_MIN} affection and 100 spirit, then wait for an open reply with her.`)
    const context=reckoningContext(game.characters[charId],game.charInfo[charId],`${game.playerFirstName} ${game.playerLastName}`.trim(),game.exCharacterDynamics,game.currentSceneTranscript)
    const result=await window.api.llm.completeReckoning(beginReckoningPrompt(context),group)
    if(!current())throw Error('The encounter changed. No spirit was spent.')
    if(!result.ok)throw Error(result.error.message)
    const thoughts=parseReckoningThoughts(result.data,context)
    const session:ReckoningSession={id:crypto.randomUUID(),charId,context,thoughts,answers:[],challenge:thoughts[0].challenge,feedback:'',attempts:0,
      ...(modIsOn('echo')&&game.exEcho.player?{echoName:game.exEcho.player.name}:{})}
    if(!canStartReckoning(useGameStore.getState(),charId))throw Error('The encounter is no longer available. No spirit was spent.')
    commit()
    // Only the current scene can be branched; do not retain old-semester timeline metadata.
    const prior=(game.exReckoning.rewinds??[]).filter(entry=>entry.date===game.date&&entry.time===game.time)
    await writeReckoningChange({version:1,active:session,rewinds:[...prior,anchorReckoning(session,game.date,game.time,game.currentSceneTranscript)]},game.exReckoning,100,charId,undefined,current)
  })
}
export async function answerReckoning(reply:string):Promise<{tag?:GrowthTag;failed?:boolean;feedback:string;reaction:string}> {
  return operation(async(group,current,commit)=>{
    const game=useGameStore.getState(),session=game.exReckoning.active
    if(!session||!canResumeReckoning(game,session.charId))throw Error('Resume this Reckoning during an open reply with her.')
    if(!reply.trim()||reply.length>1500)throw Error('Use 1–1,500 characters for your response.')
    const result=await window.api.llm.completeReckoning(answerReckoningPrompt(session,reply.trim()),group)
    if(!current())throw Error('The encounter changed; this answer was not applied.')
    if(!result.ok)throw Error(result.error.message)
    const verdict=parseReckoningVerdict(result.data,session.answers.length===2)
    const next=applyReckoningVerdict(session,reply.trim(),verdict,game.exCharacterDynamics)
    if(game.exReckoning.rewinds?.length)next.state.rewinds=game.exReckoning.rewinds
    if(next.tag)next.state.aftermath={id:next.tag.id,charId:session.charId,date:game.date,time:game.time}
    if(!canResumeReckoning(useGameStore.getState(),session.charId))throw Error('The reply window closed; this answer was not applied.')
    commit()
    await writeReckoningChange(next.state,game.exReckoning,0,session.charId,next.dynamics,current)
    return {tag:next.tag,failed:next.failed,feedback:verdict.feedback,reaction:verdict.reaction}
  })
}
