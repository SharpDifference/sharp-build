import { seedTalents, settleSavings, settleTalentPoints } from '@shared/campusTalents'
import { affectionFor } from '@shared/relationship'
import { settleTalentMemories } from '@shared/talentMemories'
import { abilityRank, anticipationReady, completeSilverLining, dancerCapability, farewellEnded, settleTalentSceneAbilities, silverLiningReady, TALENT_ABILITIES } from '@shared/talentAbilities'
import { fullNameOf } from '@shared/types'
import { registerHooks } from '../mods/hooks'
import { modIsOn } from '../stores/modsStore'
import { useGameStore } from '../stores/gameStore'
import { reconcileTraining } from '@shared/talentTrading'

export function ensureTalents(): void {
  const g=useGameStore.getState()
  if (!modIsOn('campus-talents') || !g.playthroughId || g.createdScene || g.replaying || g.exTalents.initialized) return
  const total=Object.entries(g.charInfo).reduce((sum,[id,info])=>sum+Math.max(0,affectionFor(info,g.date,g.characters[id])),0)
  useGameStore.setState({exTalents:seedTalents(g.exTalents,total,g.semesterIndex,g.date)})
}
registerHooks('campus-talents', {
  gameEntered:ensureTalents,
  projectSlotMemories:({before,closingCast},charInfo)=>{
    if (!before.playthroughId || before.createdScene || before.replaying) return charInfo
    const cast=closingCast.map(c=>c.charId)
    // Preview the pending bonus without committing the returned ability state.
    const abilities=settleTalentSceneAbilities(before.exTalents,before.charInfo,charInfo,cast,before.currentSceneTranscript,before.semesterIndex,before.date,before.time)
    return settleTalentMemories(before.exTalents,before.charInfo,charInfo,before.date,cast,abilities.bonus,modIsOn('echo')?before.exEcho:undefined)
  },
  prompts:{scene:{lines:({query,cast})=>{
    const g=useGameStore.getState()
    if (!g.playthroughId||g.replaying||g.createdScene) return []
    const lines:string[]=[]
    const silver=g.exTalents.abilities.silverLining
    if (silver && silverLiningReady(g.exTalents,g.semesterIndex,g.date,g.time) && query.includes(silver.action) &&
        g.currentSceneTranscript.slice(silver.at).filter(l=>l.speaker==='reader').at(-1)?.text===silver.action && cast.some(c=>c.charId===silver.charId))
      lines.push('SILVER LINING — a once-weekly social recovery the player has chosen for this reply. Focus on '+JSON.stringify(fullNameOf(g.characters[silver.charId]))+'. Let the reader\'s warmth, self-awareness and tact defuse the current awkwardness or conflict and create a concrete opening in his favor: a fair hearing, a workable compromise, or a renewed chance to connect. Show the turn in the scene itself, with natural dialogue and reactions. Preserve established facts and prior consequences; do not erase memories, force romance or override an explicit refusal. If there is no negative situation to recover from, continue naturally rather than inventing one. Do not mention skill names, ranks, cooldowns or game mechanics.')
    const dance=dancerCapability(g.exTalents,query+' '+g.currentSceneTranscript.slice(-4).map(l=>l.text).join(' '))
    if (dance) lines.push('DANCE CAPABILITY: '+dance)
    const f=g.exTalents.abilities.farewell
    if (f && f.term===g.semesterIndex&&f.date===g.date&&f.time===g.time&&query.includes(f.action)&&cast.some(c=>c.charId===f.charId)&&abilityRank(g.exTalents,TALENT_ABILITIES.farewell)>0)
      lines.push('The reader chose to end this meeting warmly and leave room for another. Let the goodbye close the scene if circumstances allow. Preserve the partner’s actual feelings and unresolved concerns; do not manufacture affection or promise a future response. Do not announce a perk.')
    for (const c of cast) if(anticipationReady(g.exTalents,c.charId,g.semesterIndex,g.date,g.time))
      lines.push('Meeting continuity: '+JSON.stringify({character:fullNameOf(c),fact:'Their last meeting ended warmly, with room to look forward to seeing one another again.'})+'. Let this lightly inform the greeting; present circumstances and her own choices still determine her response.')
    return lines
  }}},
  afterSceneReply:({ending,cast})=>{
    let g=useGameStore.getState()
    if(!g.playthroughId||g.createdScene||g.replaying)return
    const completed=completeSilverLining(g.exTalents,g.currentSceneTranscript,g.semesterIndex,g.date,g.time)
    if(completed!==g.exTalents){useGameStore.setState({exTalents:completed});g=useGameStore.getState()}
    const f=g.exTalents.abilities.farewell
    if(!g.playthroughId||g.createdScene||g.replaying||!f||f.term!==g.semesterIndex||f.date!==g.date||f.time!==g.time)return
    const ended=ending&&cast.some(c=>c.charId===f.charId)&&farewellEnded(g.exTalents,g.currentSceneTranscript,g.semesterIndex,g.date,g.time)
    useGameStore.setState({exTalents:{...g.exTalents,abilities:{...g.exTalents.abilities,farewell:{...f,ended}}}})
  },
  slotSettled:({before,closingCast})=>{
    const g=useGameStore.getState()
    if (!g.playthroughId || g.createdScene || g.replaying || g.loads!==before.loads || g.playthroughId!==before.playthroughId) return
    // An older save first enabled during a scene is seeded from its pre-scene relationships.
    const total=Object.entries(before.charInfo).reduce((sum,[id,info])=>sum+Math.max(0,affectionFor(info,before.date,before.characters[id])),0)
    const seeded=seedTalents(g.exTalents,total,g.semesterIndex,g.date)
    const abilityResult=settleTalentSceneAbilities(seeded,before.charInfo,g.charInfo,closingCast.map(c=>c.charId),g.currentSceneTranscript,g.semesterIndex,before.date,before.time)
    // Use the closing snapshot before this scene's stat gains, not the updated stats.
    const tracked=reconcileTraining(reconcileTraining(abilityResult.state,before.stats,g.semesterIndex),g.stats,g.semesterIndex)
    const exTalents=settleSavings(settleTalentPoints(tracked,before.charInfo,g.charInfo,g.semesterIndex,before.date,before.time,before.stats),g.semesterIndex,g.date)
    const charInfo=settleTalentMemories(exTalents,before.charInfo,g.charInfo,before.date,closingCast.map(c=>c.charId),abilityResult.bonus,modIsOn('echo')?g.exEcho:undefined)
    useGameStore.setState({exTalents,charInfo})
  }
})
