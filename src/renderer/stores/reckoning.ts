import { dynamicFor, type GrowthTag } from '@shared/characterDynamics'
import { anchorReckoning, applyReckoningVerdict, hasReckoningAffection, parseReckoningThoughts, parseReckoningVerdict, RECKONING_AFFECTION_MIN, RECKONING_MOD, type ReckoningContext, type ReckoningSession } from '@shared/reckoning'
import { optionOn } from '@shared/mods'
import { create } from 'zustand'
import { beginReckoningPrompt, answerReckoningPrompt, reckoningContext } from '../prompts/reckoningPrompt'
import { useGameStore } from './gameStore'
import { modIsOn, useModsStore } from './modsStore'
import { useSettingsStore } from './settingsStore'
import { breakthroughCast, canSpendBreakthrough } from './breakthrough'
import { writeReckoningChange } from './loop/saves'
import { loopState } from './loop/state'
type Game=ReturnType<typeof useGameStore.getState>
let flight:{group:string;cancelled:boolean;committing:boolean}|null=null
export function canStartReckoning(game:Game,id:string):boolean {
  return canKeepOpening(game,id)&&canSpendBreakthrough(game,id,100)
}
/** Keep a prepared opening through rereading and temporarily closed reply controls. */
function canKeepOpening(game:Game,id:string):boolean {
  const pending=game.exReckoning.aftermath
  return modIsOn(RECKONING_MOD)&&modIsOn('breakthrough')&&!!game.playthroughId&&!game.createdScene&&!game.replaying&&
    !game.exBreakthrough.pending&&(game.exBreakthrough.meters[id]??0)>=100&&breakthroughCast(game).includes(id)&&
    !game.exReckoning.active&&!(pending&&pending.date===game.date&&pending.time===game.time)&&
    !dynamicFor(game.exCharacterDynamics,id).growth&&hasReckoningAffection(game.charInfo[id],game.date,game.characters[id])
}

export const RECKONING_PREPARE_OPTION='prepare-questions'
type Opening={key:string;charId:string;context:ReckoningContext;status:'queued'|'preparing'|'ready'|'error';
  thoughts?:ReckoningSession['thoughts'];error?:string;group:string;cancelled:boolean;promise?:Promise<void>}
const openings=new Map<string,Opening>()
let preparing:Opening|null=null,prepareTimer:ReturnType<typeof setTimeout>|undefined,watchers=0
/** Readiness is transient; no generated question or failed request is written before activation. */
export const useReckoningPreparation=create(()=>({revision:0}))
const changed=():void=>{useReckoningPreparation.setState(s=>({revision:s.revision+1}))}
const preparationOn=():boolean=>optionOn(useModsStore.getState().switches,RECKONING_MOD,RECKONING_PREPARE_OPTION)
function openingContext(game:Game,id:string):ReckoningContext {
  return reckoningContext(game.characters[id],game.charInfo[id],`${game.playerFirstName} ${game.playerLastName}`.trim(),game.exCharacterDynamics,game.currentSceneTranscript)
}
function openingKey(game:Game,id:string,context:ReckoningContext):string {
  const s=useSettingsStore.getState().settings
  return JSON.stringify([game.playthroughId,game.loads,game.date,game.time,id,context,game.currentSceneTranscript,
    s&&[s.apiProvider,s.apiModel,s.thinkingLevel,s.endpointUrl,s.endpointModel,s.endpointSecondaryModel,s.reasoningEffort,s.maxOutputTokens,s.apiKeySet,s.endpointApiKeySet]])
}
function validOpening(opening:Opening):boolean {
  const game=useGameStore.getState()
  return !opening.cancelled&&preparationOn()&&canKeepOpening(game,opening.charId)&&
    opening.key===openingKey(game,opening.charId,openingContext(game,opening.charId))
}
export function reckoningPreparationStatus(game:Game,id:string):{status:Opening['status']|'idle';error?:string} {
  const opening=openings.get(id)
  if(!opening||!canKeepOpening(game,id)||!preparationOn()||opening.key!==openingKey(game,id,openingContext(game,id)))return {status:'idle'}
  return {status:opening.status,error:opening.error}
}
function discardOpening(opening:Opening):void {
  opening.cancelled=true
  if(openings.get(opening.charId)===opening)openings.delete(opening.charId)
  if(opening.status==='preparing')void window.api.jobs.cancelGroup(opening.group).catch(()=>{})
}
function schedulePreparation():void {
  if(!watchers||preparing||prepareTimer||flight)return
  if(![...openings.values()].some(o=>o.status==='queued'&&canStartReckoning(useGameStore.getState(),o.charId)))return
  // Briefly settle scene/state changes, including StrictMode's mount rehearsal, before a paid call.
  prepareTimer=setTimeout(()=>{prepareTimer=undefined;void runPreparation()},600)
}
async function runPreparation():Promise<void> {
  if(!watchers||preparing||flight)return
  const opening=[...openings.values()].find(o=>o.status==='queued'&&validOpening(o)&&canStartReckoning(useGameStore.getState(),o.charId))
  if(!opening)return
  preparing=opening;opening.status='preparing';changed()
  opening.promise=(async()=>{
    try {
      const result=await window.api.llm.completeReckoning(beginReckoningPrompt(opening.context),opening.group)
      if(!validOpening(opening))return
      if(!result.ok)throw Error(result.error.message)
      opening.thoughts=parseReckoningThoughts(result.data,opening.context)
      opening.status='ready'
    }catch(error){
      if(validOpening(opening)){
        opening.status='error'
        opening.error=error instanceof Error?error.message:'The reflection could not be prepared.'
      }
    }finally{
      if(preparing===opening)preparing=null
      changed();schedulePreparation()
    }
  })()
  await opening.promise
}
function syncPreparation():void {
  if(!watchers)return
  let edited=false
  for(const opening of openings.values())if(!validOpening(opening)){discardOpening(opening);edited=true}
  const game=useGameStore.getState()
  if(preparationOn()&&!flight)for(const id of breakthroughCast(game)){
    if(openings.has(id)||!canStartReckoning(game,id))continue
    const context=openingContext(game,id)
    openings.set(id,{key:openingKey(game,id,context),charId:id,context,status:'queued',cancelled:false,group:`reckoning-prepare-${crypto.randomUUID()}`})
    edited=true
  }
  if(edited)changed()
  schedulePreparation()
}
/** Mounted by the game, independent of the collapsed Breakthrough panel or selected girl. */
export function watchReckoningPreparation():()=>void {
  watchers++
  const unsubscribers=[useGameStore.subscribe(syncPreparation),useModsStore.subscribe(syncPreparation),useSettingsStore.subscribe(syncPreparation)]
  syncPreparation()
  return()=>{
    for(const unsubscribe of unsubscribers)unsubscribe()
    watchers--
    if(watchers)return
    if(prepareTimer)clearTimeout(prepareTimer)
    prepareTimer=undefined
    for(const opening of openings.values())discardOpening(opening)
    changed()
  }
}
/** A failed preparation is sticky for this context; only an explicit retry makes another call. */
export function retryReckoningPreparation(id:string):void {
  const opening=openings.get(id)
  if(opening?.status!=='error'||!canStartReckoning(useGameStore.getState(),id))return
  discardOpening(opening);syncPreparation()
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
  try{return await run(job.group,current,()=>{job.committing=true})}finally{if(flight===job)flight=null;syncPreparation()}
}
export async function startReckoning(charId:string):Promise<void> {
  return operation(async(group,current,commit)=>{
    const game=useGameStore.getState()
    if(!canStartReckoning(game,charId))throw Error(`Reach ${RECKONING_AFFECTION_MIN} affection and 100 spirit, then wait for an open reply with her.`)
    const context=openingContext(game,charId)
    const cached=openings.get(charId)
    let thoughts:ReckoningSession['thoughts']
    if(cached&&validOpening(cached)){
      // A direct caller during preparation joins that request instead of paying for a second one.
      if(cached.status==='preparing')await cached.promise
      if(!current()||!validOpening(cached))throw Error('The encounter changed. No spirit was spent.')
      if(cached.status!=='ready'||!cached.thoughts)throw Error(cached.error||'The reflection is still preparing.')
      thoughts=cached.thoughts
    }else{
      const result=await window.api.llm.completeReckoning(beginReckoningPrompt(context),group)
      if(!current())throw Error('The encounter changed. No spirit was spent.')
      if(!result.ok)throw Error(result.error.message)
      thoughts=parseReckoningThoughts(result.data,context)
    }
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
