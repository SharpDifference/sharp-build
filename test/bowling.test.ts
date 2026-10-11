import { describe, expect, it } from 'vitest'
import {
  ALL_PINS,
  ballTold,
  herThrow,
  isSplit,
  pathOf,
  rackOf,
  resolvePins,
  sheetOf,
  tableOf,
  tallyOf,
  totalOf,
  versusAccount,
  type Ball,
  type Skill,
  type Throw
} from '../src/shared/bowling'
import { gamesOffered, MINI_GAMES_LIST, suggestRate } from '../src/shared/minigames'

/** Bowling's rules: the scoring, what a ball takes, how she throws and how a game is told. */

/** A random with a seed, so a run of trials comes out the same every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const total = (rolls: number[], frames = 10): number => totalOf(rolls, frames)
const marks = (rolls: number[], frames = 10): string =>
  sheetOf(rolls, frames).map((frame) => frame.marks.join('')).join(' ')

const POCKET: Throw = { position: 3 / 17, power: 0.78, hook: 0 }
const WIDE: Throw = { position: 0.9, power: 0.7, hook: 0 }
const GUTTER: Throw = { position: 1, power: 0.3, hook: 1 }

/** A ball that took `took` of a full rack, or of what `before` left. */
function ball(hers: boolean, took: number, before: readonly number[] = ALL_PINS, thrown = WIDE): Ball {
  return { hers, thrown, before, fallen: before.slice(0, took) }
}

describe('Bowling scoring', () => {
  it('scores twelve strikes as 300 and knows the game is over', () => {
    const rolls = Array<number>(12).fill(10)
    expect(total(rolls)).toBe(300)
    expect(rackOf(rolls, 10).done).toBe(true)
    expect(rackOf(rolls.slice(0, 11), 10)).toMatchObject({ frame: 9, ball: 2, fresh: true, done: false })
    expect(sheetOf(rolls, 10).map((frame) => frame.total)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300])
  })

  it('scores all spares with the ball after each, and all gutters as nothing', () => {
    expect(total(Array<number>(21).fill(5))).toBe(150)
    expect(total(Array<number>(20).fill(0))).toBe(0)
    expect(rackOf(Array<number>(20).fill(0), 10).done).toBe(true)
    expect(marks([0, 0, 9, 1, 10, 0, 10], 4)).toBe('–– 9/ X –/')
  })

  it('gives the last frame its extra balls only when they are earned', () => {
    // An open last frame is two balls.
    expect(rackOf([3, 4, 3, 4, 3, 4], 3).done).toBe(true)
    // A spare earns one more, at a full rack.
    expect(rackOf([3, 4, 3, 4, 6, 4], 3)).toMatchObject({ ball: 2, fresh: true, done: false })
    // A strike then a count leaves the third ball at what is standing.
    expect(rackOf([3, 4, 3, 4, 10, 6], 3)).toMatchObject({ ball: 2, fresh: false, done: false })
    expect(total([3, 4, 3, 4, 10, 6, 4], 3)).toBe(34)
    expect(marks([3, 4, 3, 4, 10, 6, 4], 3)).toBe('34 34 X6/')
    expect(marks([10, 10, 10, 10, 10], 3)).toBe('X X XXX')
    expect(total([10, 10, 10, 10, 10], 3)).toBe(90)
  })

  it('holds a frame total back until the balls it counts are thrown', () => {
    const sheet = sheetOf([10, 7], 3)
    expect(sheet[0].total).toBeNull()
    expect(sheet[0].sofar).toBe(17)
    expect(sheetOf([10, 7, 2], 3).slice(0, 2).map((frame) => frame.total)).toEqual([19, 28])
  })

  it('alternates frames, the reader first, and resets the rack between them', () => {
    const first = ball(false, 7)
    expect(tableOf([first], 3, true)).toMatchObject({ hers: false, frame: 0, ball: 1 })
    expect(tableOf([first], 3, true).standing).toEqual([8, 9, 10])
    const second = ball(false, 1, [8, 9, 10])
    expect(tableOf([first, second], 3, true)).toMatchObject({ hers: true, frame: 0, ball: 0 })
    expect(tableOf([first, second], 3, true).standing).toHaveLength(10)
    expect(tableOf([first, second, ball(true, 10)], 3, true)).toMatchObject({ hers: false, frame: 1 })
    // Alone, every frame is the reader's.
    expect(tableOf([first, second], 3, false)).toMatchObject({ hers: false, frame: 1 })
  })
})

describe('Bowling pins', () => {
  const average = (thrown: Throw, trials = 2000): { pins: number; strikes: number } => {
    const rand = seeded(7)
    const path = pathOf(thrown)
    let pins = 0
    let strikes = 0
    for (let i = 0; i < trials; i++) {
      const fell = path.gutter ? 0 : resolvePins(path.arriveX, path.angle, thrown.power, ALL_PINS, rand).length
      pins += fell
      if (fell === 10) strikes++
    }
    return { pins: pins / trials, strikes: strikes / trials }
  }

  it('takes nothing from the gutter and only pins that were standing', () => {
    expect(pathOf(GUTTER).gutter).toBe(true)
    expect(resolvePins(30, 0, 0.8, ALL_PINS, seeded(1))).toEqual([])
    const rand = seeded(3)
    for (let i = 0; i < 200; i++) {
      const fell = resolvePins(rand() * 30 - 15, rand() - 0.5, rand(), [4, 7, 10], rand)
      expect(fell.every((pin) => [4, 7, 10].includes(pin))).toBe(true)
      expect(new Set(fell).size).toBe(fell.length)
    }
  })

  it('strikes from the pocket most of the time, and far more than from anywhere else', () => {
    const pocket = average(POCKET)
    const centre = average({ position: 0, power: 0.78, hook: 0 })
    const edge = average(WIDE)
    expect(pocket.strikes).toBeGreaterThan(0.55)
    expect(pocket.strikes).toBeLessThan(0.95)
    expect(pocket.pins).toBeGreaterThan(centre.pins)
    expect(centre.pins).toBeGreaterThan(edge.pins)
    expect(edge.pins).toBeLessThan(4)
    // A soft ball into the same pocket carries less.
    expect(average({ ...POCKET, power: 0.25 }).pins).toBeLessThan(pocket.pins)
  })

  it('lands a sloppy ball somewhere in the middle of the rack on average', () => {
    const rand = seeded(11)
    let pins = 0
    for (let i = 0; i < 4000; i++) {
      const thrown = { position: rand() * 2 - 1, power: rand(), hook: rand() * 2 - 1 }
      const path = pathOf(thrown)
      pins += path.gutter ? 0 : resolvePins(path.arriveX, path.angle, thrown.power, ALL_PINS, rand).length
    }
    expect(pins / 4000).toBeGreaterThan(4)
    expect(pins / 4000).toBeLessThan(8)
  })

  it('knows a split from a leave that stands together', () => {
    expect(isSplit([7, 10])).toBe(true)
    expect(isSplit([4, 6])).toBe(true)
    expect(isSplit([2, 4, 7])).toBe(false)
    expect(isSplit([10])).toBe(false)
    // Nothing is a split with the head pin still up.
    expect(isSplit([1, 7, 10])).toBe(false)
  })
})

describe('Bowling against her', () => {
  /** Her average over full games at a skill. */
  function herAverage(skill: Skill): { score: number; gutters: number } {
    const rand = seeded(42)
    let score = 0
    let gutters = 0
    const games = 300
    for (let game = 0; game < games; game++) {
      const balls: Ball[] = []
      for (let table = tableOf(balls, 10, false); !table.over; table = tableOf(balls, 10, false)) {
        const thrown = herThrow(table.standing, skill, rand)
        const path = pathOf(thrown)
        if (path.gutter) gutters++
        const fallen = path.gutter
          ? []
          : resolvePins(path.arriveX, path.angle, thrown.power, table.standing, rand)
        balls.push({ hers: false, thrown, before: table.standing, fallen })
      }
      score += tallyOf(balls, false, 10).total
    }
    return { score: score / games, gutters }
  }

  it('bowls better at every step of skill, from gutters to regular strikes', () => {
    const by = ([1, 2, 3, 4, 5] as Skill[]).map(herAverage)
    for (let i = 1; i < by.length; i++) expect(by[i].score).toBeGreaterThan(by[i - 1].score)
    expect(by[0].score).toBeLessThan(100)
    expect(by[0].gutters).toBeGreaterThan(0)
    expect(by[4].score).toBeGreaterThan(190)
    expect(by[4].score).toBeLessThan(270)
  })

  it('tells a ball for what it was', () => {
    const strike = ball(false, 10, ALL_PINS, POCKET)
    expect(ballTold('Mia', [strike], 0, 3)).toMatchObject({ kind: 'strike', notable: true, closed: true })
    expect(ballTold('Mia', [strike, strike, strike], 2, 5).kind).toBe('turkey')
    expect(ballTold('Mia', [ball(true, 0, ALL_PINS, GUTTER)], 0, 3)).toMatchObject({ kind: 'gutter', closed: false })
    const leave: Ball = { hers: false, thrown: WIDE, before: ALL_PINS, fallen: [1, 2, 3, 4, 5, 6, 8, 9] }
    expect(ballTold('Mia', [leave], 0, 3).kind).toBe('split')
    const pickup: Ball = { hers: false, thrown: WIDE, before: [7, 10], fallen: [7, 10] }
    expect(ballTold('Mia', [leave, pickup], 1, 3)).toMatchObject({ kind: 'split-converted', closed: true })
    expect(ballTold('Mia', [ball(false, 6)], 0, 3)).toMatchObject({ kind: 'count', notable: false })
  })

  it('gives the scene an account of who threw what, who led and whose luck it was', () => {
    // Three frames: he strikes off a good ball, then a loose one, then opens; she spares, gutters, counts.
    const balls: Ball[] = [
      ball(false, 10, ALL_PINS, POCKET),
      ball(true, 6),
      ball(true, 4, [7, 8, 9, 10]),
      ball(false, 10, ALL_PINS, WIDE),
      ball(true, 0, ALL_PINS, GUTTER),
      ball(true, 3),
      ball(false, 5),
      ball(false, 2, [6, 7, 8, 9, 10]),
      ball(true, 8),
      ball(true, 1, [9, 10])
    ]
    expect(tableOf(balls, 3, true).over).toBe(true)
    const mine = tallyOf(balls, false, 3)
    const hers = tallyOf(balls, true, 3)
    expect(mine).toMatchObject({ total: 49, strikes: 2, spares: 0, gutters: 0, lucky: 1 })
    expect(hers).toMatchObject({ total: 22, strikes: 0, spares: 1, gutters: 1 })
    const account = versusAccount('Mia', balls, 3).join('\n')
    expect(account).toContain('Frame 1: the reader X (a strike off a good ball); Mia 6 / (a spare)')
    expect(account).toContain('a strike off a loose ball: lucky')
    expect(account).toContain('a gutter ball')
    expect(account).toContain('The reader led from the first frame that separated them to the end.')
    expect(account).toContain('Final score: the reader 49, Mia 22: the reader won by 27')
  })
})

describe('Bowling on offer', () => {
  it('is in the build and offered where there are lanes, most readily at the arcade', () => {
    const bowling = MINI_GAMES_LIST.find((game) => game.id === 'bowling')
    expect(bowling).toBeDefined()
    if (!bowling) return
    const on = (): boolean => true
    expect(gamesOffered({ location: 'btb_arcade', girls: 0 }, on)).toContain(bowling)
    expect(gamesOffered({ location: 'btb_arcade', girls: 1 }, on)).toContain(bowling)
    expect(gamesOffered({ location: 'kendall_library', girls: 1 }, on)).not.toContain(bowling)
    expect(suggestRate(bowling, 'btb_arcade', false)).toBe('often')
    expect(bowling.options?.[0]).toMatchObject({ id: 'frames', min: 3, max: 10, default: 5 })
  })
})
