import { expect, it } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { runForCharacter } from '../src/main/services/characterWork'
import { cancelGroup } from '../src/shared/jobQueue'

function gate() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
const girl = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

it('waits through an awaited write and cleanup before character cancellation returns', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'character-work-'))
  const file = join(folder, 'photo.png')
  const writing = gate(), finish = gate()
  let signal!: AbortSignal
  let returned = false
  const work = runForCharacter('photo-feature', girl, async current => {
    signal = current
    await writing.promise
    try { await writeFile(file, 'partial'); await finish.promise }
    finally { if (current.aborted) await rm(file, { force: true }) }
  })
  const refused = expect(work).rejects.toMatchObject({ code: 'CANCELLED' })
  const cancelling = cancelGroup(girl).then(() => { returned = true })
  expect(signal.aborted).toBe(true)
  writing.release()
  await new Promise(resolve => setImmediate(resolve))
  expect(returned).toBe(false)
  finish.release()
  await cancelling
  await refused
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
  await rm(folder, { recursive: true, force: true })
})

it('cancels every mod working for this girl but leaves another girl alone', async () => {
  const done = gate()
  const signals: AbortSignal[] = []
  const one = runForCharacter('photo-feature', girl, async signal => { signals.push(signal); await done.promise })
  const two = runForCharacter('another-mod', girl, async signal => { signals.push(signal); await done.promise })
  const three = runForCharacter('another-mod', other, async signal => { signals.push(signal); await done.promise })
  const refused = Promise.all([expect(one).rejects.toMatchObject({ code: 'CANCELLED' }), expect(two).rejects.toMatchObject({ code: 'CANCELLED' })])
  const cancelling = cancelGroup(girl)
  expect(signals.map(signal => signal.aborted)).toEqual([true, true, false])
  done.release()
  await cancelling; await refused; await three
})

it('rejects invalid owner and character ids before work runs', async () => {
  let ran = false
  const work = async () => { ran = true }
  await expect(runForCharacter('../bad', girl, work)).rejects.toMatchObject({ code: 'MOD_ID_INVALID' })
  await expect(runForCharacter('photo-feature', '../bad', work)).rejects.toMatchObject({ code: 'CHARACTER_ID_INVALID' })
  expect(ran).toBe(false)
})

it('can await a queued render inside character work without an outer queue job', async () => {
  const { enqueue } = await import('../src/shared/jobQueue')
  await expect(runForCharacter('photo-feature', girl, async signal =>
    enqueue({ group: 'mod:photo-feature:render', signal, run: async () => 'bytes' })
  )).resolves.toBe('bytes')
})

it('aborts existing runAbortable work without waiting for it to settle', async () => {
  const { runAbortable } = await import('../src/shared/jobQueue')
  const finish = gate()
  let signal!: AbortSignal
  let finished = false
  const work = runAbortable(girl, async current => {
    signal = current
    await finish.promise
    finished = true
    throw Error('write stopped')
  })
  const rejected = expect(work).rejects.toThrow('write stopped')
  await cancelGroup(girl)
  expect(signal.aborted).toBe(true)
  expect(finished).toBe(false)
  finish.release()
  await rejected
})

it('waits only for character work when legacy work shares the same group', async () => {
  const { runAbortable } = await import('../src/shared/jobQueue')
  const legacyFinish = gate(), characterFinish = gate()
  let legacySignal!: AbortSignal
  let legacySettled = false
  let cancelled = false
  const legacy = runAbortable(girl, async signal => {
    legacySignal = signal
    await legacyFinish.promise
    legacySettled = true
  })
  const character = runForCharacter('photo-feature', girl, async () => characterFinish.promise)
  const rejected = expect(character).rejects.toMatchObject({ code: 'CANCELLED' })
  const cancelling = cancelGroup(girl).then(() => { cancelled = true })
  try {
    await Promise.resolve()
    expect(cancelled).toBe(false)
    expect(legacySignal.aborted).toBe(true)
    characterFinish.release()
    await cancelling
    expect(legacySettled).toBe(false)
  } finally {
    characterFinish.release()
    legacyFinish.release()
    await Promise.all([legacy, rejected, cancelling])
  }
})
