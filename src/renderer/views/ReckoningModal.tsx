import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { dynamicFor, type GrowthTag } from '@shared/characterDynamics'
import { RECKONING_AFFECTION_MIN, RECKONING_MOD } from '@shared/reckoning'
import { fullNameOf } from '@shared/types'
import { useModalShell } from '../components/useModalShell'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModOption } from '../stores/modsStore'
import { useAudioStore } from '../stores/audioStore'
import { spriteUrl, useSpriteVersion } from '../stores/characterStore'
import { answerReckoning, cancelReckoningRequest, canResumeReckoning, canStartReckoning, startReckoning, canContinueReckoning, RECKONING_PREPARE_OPTION, watchReckoningPreparation, useReckoningPreparation, reckoningPreparationStatus, retryReckoningPreparation } from '../stores/reckoning'
import { submitReckoningAftermath } from '../stores/gameLoop'
import { StagedEcho } from './EchoPanel'
import '../vu_styles/Reckoning.css'

/** Closing the reward, or loading its saved continuation, starts one private scene beat. */
export function ReckoningContinuation({blocked}:{blocked:boolean}):null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD)
  useEffect(()=>{if(!blocked&&on&&canContinueReckoning(game))void submitReckoningAftermath()},[blocked,on,game])
  return null
}

export function ReckoningPreparation():null {
  useEffect(()=>watchReckoningPreparation(),[])
  return null
}

export function ReckoningEntry({charId,blocked,onOpen}:{charId:string;blocked:boolean;onOpen?:(id:string)=>void}):JSX.Element|null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD)
  const prepare=useModOption(RECKONING_MOD,RECKONING_PREPARE_OPTION)
  useReckoningPreparation(s=>s.revision)
  const [launching,setLaunching]=useState(false),[launchError,setLaunchError]=useState('')
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>setLaunchError(''),[charId])
  if(!on||!onOpen)return null
  const earned=dynamicFor(game.exCharacterDynamics,charId).growth,resume=game.exReckoning.active?.charId===charId
  const ready=resume?canResumeReckoning(game,charId):canStartReckoning(game,charId)
  const prepared=reckoningPreparationStatus(game,charId),waiting=prepare&&!resume&&prepared.status!=='ready'
  const open=async():Promise<void>=>{
    if(launching)return
    if(resume||!prepare){onOpen(charId);return}
    setLaunching(true);setLaunchError('')
    try{
      // Commit the cached encounter before showing its modal: its first frame has question one.
      await startReckoning(charId)
      if(mounted.current)onOpen(charId)
    }catch(error){if(mounted.current)setLaunchError(error instanceof Error?error.message:'The encounter could not be saved.')}
    finally{if(mounted.current)setLaunching(false)}
  }
  return <section className="vu-reckoning-entry"><strong>Reckoning</strong><p>{earned?`Earned growth · ${earned.name}`:resume?'An unfinished encounter awaits. Progress saved.':`Affection ${RECKONING_AFFECTION_MIN}+ · 100 spirit. Three thoughts. One attempt.`}</p>
    {!earned&&ready&&waiting&&prepared.status==='error'?<><p role="alert">{prepared.error}</p><button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={blocked} onClick={()=>retryReckoningPreparation(charId)}>Retry preparation</button></>:
      !earned&&<button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={blocked||!ready||waiting||launching} onClick={()=>void open()}>{launching?'Opening…':resume?'Resume Reckoning':ready&&waiting?'Preparing reflection…':'Face the reflection'}</button>}
    {launchError&&<p role="alert">{launchError}</p>}
  </section>
}

const CRACKS=['M0 90 180 170 310 120 470 270 510 430 720 520 1000 450 M310 120 345 0 M470 270 240 450 0 420',
  'M1000 100 810 230 620 190 510 430 390 590 320 800 M810 230 850 400 1000 610 M620 190 520 0',
  'M0 690 240 450 510 430 720 520 800 800 M240 450 100 230 0 200 M720 520 820 650 1000 700']
export function ReckoningModal({charId,onClose}:{charId:string;onClose:()=>void}):JSX.Element|null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD),breakthroughOn=useModOn('breakthrough')
  const echoOn=useModOn('echo'),playerEcho=echoOn?game.exEcho.player:null
  const glitchEffects=useModOption(RECKONING_MOD,'glitch-effects')
  const character=game.characters[charId],session=game.exReckoning.active?.charId===charId?game.exReckoning.active:null
  const [reply,setReply]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [terminal,setTerminal]=useState<{failed?:boolean;tag?:GrowthTag;feedback:string;reaction:string}|null>(null)
  const [resolved,setResolved]=useState<{round:number;feedback:string;reaction:string}|null>(null)
  const version=useSpriteVersion(charId),[missing,setMissing]=useState(false)
  const mounted=useRef(true),opening=useRef(!!session),opened=useRef({playthroughId:game.playthroughId,loads:game.loads})
  const close=():void=>{if(cancelReckoningRequest())onClose();else setError('Finishing the save…')}
  const {host,overlayProps}=useModalShell(close,'none')
  const textArea=useRef<HTMLElement>(null)
  useLayoutEffect(()=>{
    const area=textArea.current
    if(!area)return
    let frame=0,disposed=false
    const fit=():void=>{
      // Fit the whole statement, including feedback, without shrinking below readable sizes.
      for(let step=0;step<=5;step++){
        area.style.setProperty('--reckoning-text-scale',String(1-step*.04))
        if(area.scrollHeight<=area.clientHeight+1)break
      }
    }
    const resize=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)})
    fit();area.scrollTop=0;resize.observe(area)
    void document.fonts.ready.then(()=>{if(!disposed)fit()})
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect()}
  },[host,character,session,terminal,resolved])
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelReckoningRequest()}},[])
  useEffect(()=>{if(!on||!breakthroughOn||game.playthroughId!==opened.current.playthroughId||game.loads!==opened.current.loads)close()},[on,breakthroughOn,game.playthroughId,game.loads])
  useEffect(()=>{useAudioStore.getState().setReckoningActive(!!session||!!terminal,!!terminal?.tag)},[!!session,!!terminal,!!terminal?.tag])
  useEffect(()=>()=>useAudioStore.getState().setReckoningActive(false),[])
  const request=async(start:boolean):Promise<void>=>{
    if(busy||resolved)return
    setBusy(true);setError('')
    try {
      if(start)await startReckoning(charId)
      else {
        const round=(session?.answers.length??0)+1
        const result=await answerReckoning(reply)
        if(mounted.current){
          setReply('')
          if(result.failed||result.tag)setTerminal(result)
          else setResolved({round,feedback:result.feedback,reaction:result.reaction})
        }
      }
    } catch(e){if(mounted.current)setError(e instanceof Error?e.message:'The response could not be saved. Try again.')}
    finally{if(mounted.current)setBusy(false)}
  }
  useEffect(()=>{
    if(!host||!character||opening.current||session||terminal)return
    // Defer until after effect setup so StrictMode's rehearsal cannot start a paid request.
    let disposed=false
    queueMicrotask(()=>{
      if(disposed||!mounted.current||opening.current)return
      opening.current=true
      void request(true)
    })
    return()=>{disposed=true}
  },[host,character,session,terminal])
  if(!host||!character)return null
  const cleared=terminal?.tag?3:session?.answers.length??0
  const name=fullNameOf(character),active=!!session||!!terminal
  const glitching=glitchEffects&&!!session&&!terminal&&!resolved&&!busy&&!error
  return createPortal(<div className="vu-reckoning-veil" data-glitching={glitching||undefined} {...overlayProps}>
    {glitching&&<div className="vu-reckoning-interference" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>}
    {active&&playerEcho&&game.exEcho.visible&&<div className="vu-reckoning-echo echo-reflection-stage" aria-hidden="true"><StagedEcho identity={playerEcho} opacity={game.exEcho.opacity} player preview owner="player"/></div>}
    <section className="vu-reckoning" data-cleared={cleared} data-active={active} data-failed={terminal?.failed||undefined} role="dialog" aria-modal="true" aria-label={`Reckoning with ${name}`} style={{'--reckoning-light':cleared/3} as CSSProperties}>
      <div className="vu-reckoning-portrait" aria-hidden="true">{!missing&&<img src={spriteUrl(charId,'neutral',version)} alt="" onError={()=>setMissing(true)}/>}</div>
      {terminal?.tag&&<div className="vu-reckoning-victory" aria-hidden="true"><div className="vu-reckoning-dawn"/>{Array.from({length:18},(_,i)=><i key={i} style={{'--shard-angle':`${i*20}deg`,'--shard-delay':`${(i%5)*.05}s`,'--shard-distance':`${210+(i%4)*75}px`} as CSSProperties}/>)}</div>}
      <div className="vu-reckoning-light" aria-hidden="true"/>
      <svg className="vu-reckoning-glass" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">{CRACKS.slice(0,cleared).map((d,i)=><g key={i}><path d={d}/><path className="vu-reckoning-glint" d={d}/></g>)}</svg>
      <header><div><small>{name}</small><h1>Reckoning</h1>{active&&playerEcho&&<p className="vu-reckoning-private">Inwardly, you call to {session?.echoName||playerEcho.name}.</p>}</div><button type="button" className="vu-reckoning-close" aria-label="Close Reckoning" onClick={close}>×</button></header>
      <ol className="vu-reckoning-rounds" aria-label="Thoughts resolved">{[0,1,2].map(i=><li key={i} data-done={i<cleared} aria-current={!terminal&&i===(resolved?cleared-1:cleared)?'step':undefined}>{i<cleared?'✦':'◇'}<span>{i+1}</span></li>)}</ol>
      <main ref={textArea} aria-live="polite" tabIndex={0} aria-label="Reckoning statement">
        {terminal?<div className="vu-reckoning-outcome"><small>{terminal.failed?'The reflection stands':'Three fractures. A different way forward.'}</small><h2>{terminal.failed?'The glass holds.':'The light gets through.'}</h2><p className="vu-reckoning-challenge">{terminal.reaction}</p><p>{terminal.feedback}</p>{terminal.tag?<div className="vu-reckoning-earned"><small>Character Dynamics · earned growth</small><h3>{terminal.tag.name}</h3><p>{terminal.tag.description}</p><p>Her personality remains her own. These old beliefs have less hold on her.</p></div>:<p>No growth tag was earned. The 100 spirit is spent; rebuild it to try again.</p>}</div>:
          resolved?<div className="vu-reckoning-resolved"><small>Progress saved · {resolved.round} of 3</small><h2>Thought {resolved.round} resolved</h2><p className="vu-reckoning-challenge">“{resolved.reaction}”</p><p className="vu-reckoning-feedback">{resolved.feedback}</p><p className="vu-reckoning-note">A fracture opens. Another thought waits beyond it.</p></div>:
          session?<div className="vu-reckoning-thought" key={`${session.id}:${cleared}`}><small className="vu-reckoning-round-label">THOUGHT {cleared+1} OF 3 · {cleared} RESOLVED</small><h2>{session.thoughts[cleared].belief}</h2><p className="vu-reckoning-challenge">“{session.challenge}”</p></div>:
          <div className="vu-reckoning-loading"><h2>{error?'The reflection is waiting.':'The reflection takes shape…'}</h2></div>}
      </main>
      <footer>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">{session?'Listening to your answer…':'Finding the thoughts behind the reflection…'}</p>}
        {resolved?<div className="vu-reckoning-footer-actions"><button type="button" className="vu-reckoning-secondary" onClick={close}>Pause · progress saved</button><button type="button" className="vu-reckoning-primary" autoFocus disabled={busy} onClick={()=>setResolved(null)}>Continue to thought {resolved.round+1}</button></div>:
          session&&!terminal?<form onSubmit={e=>{e.preventDefault();void request(false)}}><label htmlFor="reckoning-reply">Your answer<textarea id="reckoning-reply" value={reply} onChange={e=>setReply(e.target.value)} maxLength={1500} rows={3} disabled={busy} placeholder="I understand why it feels that way. But remember…" autoFocus/></label><div><span>{reply.length} / 1,500</span><button type="button" className="vu-reckoning-secondary" onClick={close}>{busy?'Cancel request & pause':'Pause · progress saved'}</button><button className="vu-reckoning-primary" disabled={busy||!reply.trim()||!canResumeReckoning(game,charId)} type="submit">Answer the reflection</button></div></form>:
          <div className="vu-reckoning-footer-actions"><button type="button" className="vu-reckoning-secondary" onClick={close}>{terminal?'Return to the scene':busy?'Cancel request':'Close'}</button>{!terminal&&error&&<button type="button" className="vu-reckoning-primary" disabled={busy||!canStartReckoning(game,charId)} onClick={()=>void request(true)}>Try again</button>}</div>}
      </footer>
    </section>
  </div>,host)
}
