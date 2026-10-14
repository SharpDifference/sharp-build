import type { ModDef } from '../mods'
import { normalizeEcho, type EchoState } from '../echo'
import { registerTermCarry } from '../modCarry'
import { ECHO_BREAKTHROUGH_OPTION } from '../echoBreakthrough'
declare module '../modCarry' { interface ModCarryFields { exEcho?: EchoState } }
registerTermCarry('exEcho', save => save.exEcho ? normalizeEcho(save.exEcho) : undefined)
const mod: ModDef = {
  id: 'echo', name: 'Echo', author: 'Maestro Leeds', version: '0.14.1-local', scope: 'anytime', defaultOn: true,
  blurb: 'Named ethereal companions shaped by character profiles, with matching and competing bonds.',
  offNote: 'Keeps your Echo choices, type lock and artwork; hides companions and disables affinity effects.',
  options: [{id:'megaten-art',label:'Local Megaten artwork',default:false,
    hint:'Off by default: use Gemini or the image API in Settings, with local background removal. Turn on for ComfyUI and the Megaten style LoRA instead. Echo only; existing images stay unchanged.'},
    {id:ECHO_BREAKTHROUGH_OPTION,label:'Echo Breakthrough abilities',default:true,
      hint:'Every player Echo aspect has a one-exchange ability costing 25, 50 or 75 spirit by conversational influence. Requires Breakthrough. Normal Breakthrough stays at 100.'}]
}
export default mod
