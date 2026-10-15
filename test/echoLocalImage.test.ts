import { beforeEach, describe, expect, it, vi } from 'vitest'
import workflow from '../assets/workflows/echoMegaten.json'
const mocks=vi.hoisted(()=>({stat:vi.fn(),readFile:vi.fn(),rm:vi.fn(),start:vi.fn(),run:vi.fn()}))
vi.mock('fs/promises',()=>({stat:mocks.stat,readFile:mocks.readFile,rm:mocks.rm}))
vi.mock('../src/main/paths',()=>({getComfyModelFilePath:(folder:string,file:string)=>`${folder}/${file}`,getComfyPythonPath:()=> 'python.exe',getComfyUiPath:()=> 'comfy',getTempPath:()=> 'temporary'}))
vi.mock('../src/main/services/comfyService',()=>({start:mocks.start,runGenerationJob:mocks.run}))
import { generateLocalEcho } from '../src/main/services/echoLocalImage'
beforeEach(()=>{vi.resetAllMocks();mocks.stat.mockResolvedValue({});mocks.readFile.mockResolvedValue(Buffer.from('image'));mocks.rm.mockResolvedValue(undefined)})
describe('Echo-only local artwork',()=>{
  it('returns raw artwork for the shared portable remover without a Python cutout node',()=>{
    expect(workflow['9'].inputs.images).toEqual(['8',0])
    expect(workflow['9'].inputs.filename_prefix).toBe('echo_sources/raw')
    expect(workflow['5'].inputs.text).toContain('silhouette')
    expect(workflow['5'].inputs.text).not.toContain('white background')
  })
  it('uses its own LoRA, clip skip and model without the portrait style LoRA',()=>{
    expect(workflow['2'].inputs.lora_name).toBe('Megaten_Style.safetensors')
    expect(workflow['2'].inputs.strength_model).toBe(.7)
    expect(workflow['3'].inputs.stop_at_clip_layer).toBe(-2)
    expect(JSON.stringify(workflow)).not.toContain('usnrStyle')
  })
  it('passes saved design and trigger to the isolated graph and removes temporary output',async()=>{
    const signal=new AbortController().signal
    expect(await generateLocalEcho('Frostfang, armored wolf',signal)).toEqual(Buffer.from('image'))
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({workflowFile:'echoMegaten.json',prompts:expect.objectContaining({positive:expect.stringContaining('Frostfang, armored wolf')})}),{signal})
    expect(mocks.run.mock.calls[0][0].prompts.positive).toContain('kazuma_kaneko_(style)')
    expect(mocks.rm).toHaveBeenCalledTimes(2)
  })
  it('refuses missing local assets without quietly making a paid request',async()=>{
    mocks.stat.mockRejectedValue(Error('missing'))
    await expect(generateLocalEcho('wolf',new AbortController().signal)).rejects.toThrow('Install local art models')
    expect(mocks.start).not.toHaveBeenCalled();expect(mocks.run).not.toHaveBeenCalled()
  })
  it('honors cancellation and removes temporary files after render failure',async()=>{
    const controller=new AbortController();controller.abort()
    await expect(generateLocalEcho('wolf',controller.signal)).rejects.toThrow()
    expect(mocks.start).not.toHaveBeenCalled()
    mocks.run.mockRejectedValue(Error('render failed'))
    await expect(generateLocalEcho('wolf',new AbortController().signal)).rejects.toThrow('render failed')
    expect(mocks.rm).toHaveBeenCalledTimes(2)
  })
})
