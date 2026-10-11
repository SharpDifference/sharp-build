import { describe, expect, it } from 'vitest'
import { seededRand } from '../src/shared/hash'
import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, suggestRate } from '../src/shared/minigames'
import SWIM_MOD from '../src/shared/modEntries/morrowkiln-sports'
import {
  BREATH_GAP_MS,
  CYCLE_MS,
  GASP_MS,
  LENGTH_M,
  PULL_MS,
  TURN_GOOD_M,
  TURN_PERFECT_M,
  TURN_ZONE_M,
  advance,
  breathe,
  callTurn,
  clockOf,
  courseWords,
  herMind,
  herMove,
  herRace,
  herReaction,
  herTurn,
  legLabel,
  lengthsOf,
  onBlocks,
  orderNow,
  outcomeOf,
  placesOf,
  raceAccount,
  raceSummary,
  stroke,
  strokeOf,
  strokeWorth,
  swimming,
  toWall,
  turnPlace,
  waterAt,
  type Skill,
  type Swimmer,
  type TurnGrade
} from '../src/shared/minigameRules/swimRace'

/** Swim Race's rules: the stroke, the air, the turn, how she swims, and how a race is placed. */

const SKILLS: readonly Skill[] = [1, 2, 3, 4, 5]
const STEP = 16

/** A swimmer already in open water, `dist` metres in. */
function inWater(dist = 5): Swimmer {
  const swimmer = onBlocks(0)
  swimmer.dist = dist
  swimmer.speed = 2
  return swimmer
}

/**
 * The reader as a machine: the same pull at the same tempo all the way, a breath under
 * `breatheAt`, and a turn called `turnAt` metres from each wall (never, where it is null).
 */
function swum(
  lengths: number,
  pullMs: number,
  cycleMs: number,
  breatheAt: number,
  turnAt: number | null
): Swimmer {
  const swimmer = onBlocks(200)
  let next = 0
  let first = true
  for (let clock = STEP; swimmer.finishMs === null && clock < 900_000; clock += STEP) {
    advance(swimmer, STEP, clock, lengths)
    if (!swimming(swimmer)) {
      next = 0
      continue
    }
    if (turnAt !== null && toWall(swimmer) <= turnAt) callTurn(swimmer, lengths)
    next -= STEP
    if (next > 0) continue
    next += cycleMs
    if (swimmer.air < breatheAt) breathe(swimmer)
    stroke(swimmer, pullMs, first ? null : cycleMs)
    first = false
  }
  return swimmer
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length

describe('Swim Race stroke', () => {
  it('is worth most pulled long and even, and little thrashed', () => {
    expect(strokeWorth(PULL_MS, CYCLE_MS)).toBe(1)
    expect(strokeWorth(PULL_MS, null)).toBe(1)
    expect(strokeWorth(PULL_MS / 2, CYCLE_MS)).toBeLessThan(0.5)
    expect(strokeWorth(PULL_MS, CYCLE_MS / 2)).toBeLessThan(0.6)
    // A late stroke loses nothing of itself; a pull held far too long loses a little.
    expect(strokeWorth(PULL_MS, CYCLE_MS * 2)).toBe(1)
    expect(strokeWorth(PULL_MS * 3, CYCLE_MS)).toBeLessThan(1)
    expect(strokeWorth(PULL_MS * 3, CYCLE_MS)).toBeGreaterThanOrEqual(0.5)
  })

  it('makes three short fast strokes worth less than one long one, at more air', () => {
    const long = inWater()
    const short = inWater()
    stroke(long, PULL_MS, CYCLE_MS)
    for (let i = 0; i < 3; i++) stroke(short, PULL_MS / 3, CYCLE_MS / 3)
    expect(short.speed).toBeLessThan(long.speed)
    expect(short.air).toBeLessThan(long.air)
    expect(short.thrashed).toBe(3)
  })

  it('does nothing on the blocks, at a wall or once home', () => {
    const waiting = onBlocks(300)
    expect(stroke(waiting, PULL_MS, null)).toEqual({ worth: 0, emptied: false })
    expect(breathe(waiting)).toBe(false)
    expect(waiting.strokes).toBe(0)
    const home = inWater()
    home.finishMs = 1000
    expect(strokeOf(home, 1)).toBe(false)
    expect(home.strokes).toBe(0)
  })

  it('wins a length with rhythm, not with speed of hand', () => {
    const even = swum(2, PULL_MS, CYCLE_MS, 0.2, 0.6)
    const thrashed = swum(2, 150, 300, 0.2, 0.6)
    expect(even.finishMs).toBeGreaterThan(18_000)
    expect(even.finishMs).toBeLessThan(26_000)
    expect(thrashed.finishMs ?? 0).toBeGreaterThan((even.finishMs ?? 0) * 1.5)
  })
})

describe('Swim Race air', () => {
  it('runs out under strokes alone, and the stroke that empties her starts her gasping', () => {
    const swimmer = inWater()
    let emptied = 0
    let taken = 0
    while (emptied === 0 && taken < 50) {
      taken++
      if (strokeOf(swimmer, 1)) emptied++
    }
    expect(taken).toBeGreaterThan(8)
    expect(taken).toBeLessThan(16)
    expect(swimmer.gaspMs).toBe(GASP_MS)
    expect(swimmer.gasps).toBe(1)
    // Gasping, a stroke is worth far less, no breath can be taken, and no air is spent.
    const before = swimmer.speed
    swimmer.speed = 1
    strokeOf(swimmer, 1)
    const gasped = swimmer.speed - 1
    expect(breathe(swimmer)).toBe(false)
    expect(swimmer.gasps).toBe(1)
    const fresh = inWater()
    fresh.speed = 1
    strokeOf(fresh, 1)
    expect(gasped).toBeLessThan((fresh.speed - 1) / 2)
    expect(before).toBeGreaterThan(0)
    // It passes, and leaves her with air to go on with.
    advance(swimmer, GASP_MS, 10_000, 6)
    expect(swimmer.gaspMs).toBe(0)
    expect(swimmer.air).toBeGreaterThan(0.3)
  })

  it('comes back only with a breath, which costs speed and cannot be taken twice running', () => {
    const swimmer = inWater()
    for (let i = 0; i < 6; i++) strokeOf(swimmer, 1)
    const [air, speed] = [swimmer.air, swimmer.speed]
    advance(swimmer, 500, 500, 6)
    expect(swimmer.air).toBeLessThan(air)
    const going = swimmer.speed
    expect(breathe(swimmer)).toBe(true)
    expect(swimmer.air).toBeGreaterThan(air)
    expect(swimmer.speed).toBeLessThan(going)
    expect(speed).toBeGreaterThan(going)
    expect(breathe(swimmer)).toBe(false)
    advance(swimmer, BREATH_GAP_MS, 2000, 6)
    expect(breathe(swimmer)).toBe(true)
    expect(swimmer.breaths).toBe(2)
  })

  it('costs more to ignore than to manage', () => {
    const managed = swum(4, PULL_MS, CYCLE_MS, 0.2, 0.6)
    const ignored = swum(4, PULL_MS, CYCLE_MS, -1, 0.6)
    expect(managed.gasps).toBe(0)
    expect(ignored.gasps).toBeGreaterThan(1)
    expect(ignored.finishMs ?? 0).toBeGreaterThan((managed.finishMs ?? 0) + 2000)
  })
})

describe('Swim Race turn', () => {
  it('is judged by how close to the wall it is called, once, and never on the last length', () => {
    const at = (away: number, length = 1): Swimmer => inWater(length * LENGTH_M - away)
    expect(callTurn(at(TURN_ZONE_M + 0.5), 2)).toBeNull()
    expect(callTurn(at(TURN_ZONE_M - 0.2), 2)).toBe('early')
    expect(callTurn(at(TURN_GOOD_M - 0.1), 2)).toBe('good')
    const close = at(TURN_PERFECT_M - 0.1)
    expect(callTurn(close, 2)).toBe('perfect')
    expect(callTurn(close, 2)).toBeNull()
    expect(callTurn(at(0.5, 2), 2)).toBeNull()
  })

  it('gets a better turn off the wall sooner and faster', () => {
    /** How long a swimmer who turns this way takes from 1 m short of the wall to 5 m past it. */
    const through = (grade: TurnGrade | null): number => {
      const swimmer = inWater(LENGTH_M - 1)
      swimmer.called = grade
      let clock = 0
      while (swimmer.dist < LENGTH_M + 5 && clock < 60_000) {
        clock += STEP
        advance(swimmer, STEP, clock, 2)
      }
      expect(swimmer.turns).toEqual([grade ?? 'late'])
      return clock
    }
    const [perfect, good, early, late] = [through('perfect'), through('good'), through('early'), through(null)]
    expect(perfect).toBeLessThan(good)
    expect(good).toBeLessThan(early)
    expect(early).toBeLessThan(late)
  })

  it('touches at the end of the last length, at the moment inside the step it happened', () => {
    const swimmer = inWater(2 * LENGTH_M - 0.5)
    swimmer.speed = 2.5
    const events = advance(swimmer, 1000, 30_000, 2)
    expect(events).toEqual([{ kind: 'finish' }])
    expect(swimmer.dist).toBe(2 * LENGTH_M)
    expect(swimmer.finishMs).toBeGreaterThan(29_000)
    expect(swimmer.finishMs).toBeLessThan(30_000)
    expect(advance(swimmer, 1000, 31_000, 2)).toEqual([])
  })

  it('holds a swimmer on the blocks for her reaction, and longer for a false start', () => {
    const fair = onBlocks(300)
    const jumped = onBlocks(0, true)
    expect(advance(fair, 200, 200, 2)).toEqual([])
    expect(fair.dist).toBe(0)
    expect(advance(fair, 200, 400, 2)).toEqual([{ kind: 'dive' }])
    expect(fair.dist).toBeGreaterThan(0)
    advance(jumped, 400, 400, 2)
    expect(jumped.dist).toBe(0)
    expect(jumped.falseStart).toBe(true)
  })
})

describe('Swim Race opponent', () => {
  it('swims the same race from the same seed', () => {
    expect(herRace(3, 4, seededRand('same'))).toEqual(herRace(3, 4, seededRand('same')))
  })

  it.each([1, 2, 3])('is faster the better she is, at option %i', (option) => {
    const lengths = lengthsOf(option)
    const typical = SKILLS.map((skill) =>
      mean(Array.from({ length: 40 }, (_, run) => herRace(skill, lengths, seededRand(`${skill}:${lengths}:${run}`)).finishMs ?? 0))
    )
    for (let i = 1; i < typical.length; i++) expect(typical[i]).toBeLessThan(typical[i - 1] - 500)
    // The best of them is close behind a faultless swim, and nobody is out of sight.
    const faultless = swum(lengths, PULL_MS, CYCLE_MS, 0.2, 0.6).finishMs ?? 0
    expect(typical[4]).toBeGreaterThan(faultless)
    expect(typical[4]).toBeLessThan(faultless * 1.15)
    expect(typical[0]).toBeLessThan(faultless * 2)
  })

  it('fades over a long race when she is unfit, and holds her pace when she is fit', () => {
    /** Her pace over six lengths as a share of her pace over two. */
    const held = (skill: Skill): number => {
      const over = (lengths: number): number =>
        mean(Array.from({ length: 40 }, (_, run) => herRace(skill, lengths, seededRand(`f${skill}:${run}`)).finishMs ?? 0)) / lengths
      return over(6) / over(2)
    }
    expect(held(1)).toBeGreaterThan(held(5) + 0.05)
  })

  it('manages her air by her skill: a poor swimmer gasps, a good one never does', () => {
    const gasps = (skill: Skill): number =>
      mean(Array.from({ length: 40 }, (_, run) => herRace(skill, 4, seededRand(`g${skill}:${run}`)).gasps))
    expect(gasps(1)).toBeGreaterThan(1)
    expect(gasps(5)).toBe(0)
    expect(gasps(4)).toBeLessThan(0.2)
  })

  it('turns by her skill, and makes the turn she set out to make', () => {
    const rand = seededRand('turns')
    const share = (skill: Skill, grade: TurnGrade): number =>
      Array.from({ length: 400 }, () => herTurn(skill, rand)).filter((turn) => turn === grade).length / 400
    expect(share(5, 'perfect')).toBeGreaterThan(share(1, 'perfect') + 0.4)
    expect(share(1, 'late')).toBeGreaterThan(share(5, 'late') + 0.2)
    expect(herTurn(3, () => 0)).toBe('perfect')
    expect(herTurn(3, () => 0.999)).toBe('late')
    // Whatever she has in mind as she nears the wall is what the wall sees.
    for (const [drawn, grade] of [[0, 'perfect'], [0.5, 'good'], [0.8, 'early'], [0.999, 'late']] as const) {
      const swimmer = inWater(LENGTH_M - TURN_ZONE_M - 1)
      const mind = herMind()
      let turned = false
      for (let clock = STEP; clock < 60_000 && swimmer.turns.length === 0; clock += STEP) {
        advance(swimmer, STEP, clock, 2)
        // The one draw that matters here is the turn's: everything else is taken as it comes.
        const near = !turned && mind.turn === null && toWall(swimmer) <= TURN_ZONE_M
        herMove(swimmer, mind, 3, STEP, 2, near ? () => drawn : () => 0.6)
        if (mind.turn !== null) turned = true
      }
      expect(swimmer.turns).toEqual([grade])
    }
  })

  it('leaves the blocks sooner the more she has raced', () => {
    expect(herReaction(5, () => 0.5)).toBeLessThan(herReaction(1, () => 0.5))
    expect(herReaction(5, () => 0)).toBeGreaterThan(100)
  })
})

describe('Swim Race result', () => {
  /** A finished swimmer with this time. */
  const home = (ms: number, change: Partial<Swimmer> = {}): Swimmer => ({
    ...onBlocks(250),
    dist: 50,
    blockMs: 0,
    finishMs: ms,
    strokes: 20,
    worth: 17,
    breaths: 3,
    turns: ['good'],
    ...change
  })

  it('reads the lengths option as 2, 4 or 6 lengths', () => {
    expect([1, 2, 3].map(lengthsOf)).toEqual([2, 4, 6])
    expect(lengthsOf(undefined)).toBe(2)
    expect(lengthsOf(9)).toBe(6)
  })

  it('places by time to the hundredth, sharing a place on a tie', () => {
    expect(placesOf([24_000, 23_000, 25_000])).toEqual([2, 1, 3])
    expect(placesOf([23_004, 23_001, 25_000])).toEqual([1, 1, 3])
    expect(placesOf([23_010, 23_000])).toEqual([2, 1])
    expect(outcomeOf([23_000, 24_000, 25_000])).toBe('won')
    expect(outcomeOf([23_004, 23_001, 25_000])).toBe('draw')
    expect(outcomeOf([24_000, 23_000, 23_000])).toBe('lost')
    expect(outcomeOf([23_000])).toBe('won')
  })

  it('orders the water by who has touched, then by how far each has swum', () => {
    const [ahead, behind] = [inWater(30), inWater(20)]
    expect(orderNow([behind, ahead, home(20_000), home(19_000)])).toEqual([3, 2, 1, 0])
  })

  it('writes a time as the board shows it', () => {
    expect(clockOf(23_414)).toBe('23.41')
    expect(clockOf(63_070)).toBe('1:03.07')
    expect(clockOf(250)).toBe('0.25')
  })

  it('names everyone and says who won, in the summary and the account', () => {
    const all = [
      { name: 'You', swimmer: home(24_500, { gasps: 1, thrashed: 14, worth: 6 }) },
      { name: 'Ana', swimmer: home(23_900, { turns: ['perfect'] }) },
      { name: 'Bea', swimmer: home(31_000, { gasps: 2, turns: ['late'] }) },
      { name: 'Cy', swimmer: home(24_050) }
    ]
    const summary = raceSummary(all, 2)
    const account = raceAccount(all, 2, ['Ana']).join('\n')
    for (const name of ['Ana', 'Bea', 'Cy']) {
      expect(summary).toContain(name)
      expect(account).toContain(name)
    }
    expect(summary).toMatch(/^You race/)
    expect(summary).toContain('Ana wins')
    expect(summary).toContain('third')
    expect(account).toContain('the reader')
    expect(account).not.toMatch(/\bYou\b/)
    expect(account).toContain('1. Ana 23.90')
    expect(account).toContain('3. the reader 24.50')
    for (const time of ['24.50', '23.90', '31.00', '24.05']) expect(summary).toContain(time)

    expect(raceSummary(all.slice(0, 2), 2)).toContain('lose')
    expect(raceSummary([all[1], all[0]].map((entry, i) => ({ ...entry, name: i ? 'Ana' : 'You' })), 2)).toContain('win')
    const level = [{ name: 'You', swimmer: home(23_000) }, { name: 'Ana', swimmer: home(23_003) }]
    expect(raceSummary(level, 2)).toContain('dead heat')
    expect(raceAccount(level, 2, ['the reader']).join('\n')).toContain('dead heat')
    const alone = [{ name: 'You', swimmer: home(23_000) }]
    expect(raceSummary(alone, 2)).toContain('23.00')
    expect(raceAccount(alone, 2, []).join('\n')).toContain('alone')
  })
})

describe('Swim Race on paper', () => {
  const swim = MINI_GAMES_LIST.find((game) => game.id === 'swim-race')

  it('is one of the games this build carries, a pack that requires the framework', () => {
    expect(swim?.modId).toBe(SWIM_MOD.id)
    expect(SWIM_MOD.requires).toEqual([MINI_GAMES])
    expect(swim?.players).toEqual({ min: 0, max: 3 })
    expect(swim?.options?.map((option) => [option.id, option.min, option.max, option.default])).toEqual([
      ['lengths', 1, 3, 1]
    ])
  })

  it('is played where there is water, and nowhere else', () => {
    if (!swim) throw new Error('no swim race')
    const on = (): boolean => true
    const at = (location: string | null): boolean =>
      gamesOffered({ location, girls: 0 }, on, [swim]).length === 1
    expect(swim.locations).toEqual(['palaestra_stadium', 'selkie_beach'])
    expect(at('palaestra_stadium')).toBe(true)
    expect(at('selkie_beach')).toBe(true)
    expect(at('lowrise_dorms')).toBe(false)
    expect(at(null)).toBe(false)
    expect(suggestRate(swim, 'palaestra_stadium', false)).toBe('often')
    expect(suggestRate(swim, 'selkie_beach', false)).toBe('sometimes')
  })
})

/**
 * The reader as an ordinary player: every pull and every cycle up to 120 ms out either way, a
 * breath every third or fourth stroke, and turns that are good rather than perfect.
 */
function ordinary(lengths: number, rand: () => number): Swimmer {
  const swimmer = onBlocks(Math.round(300 + rand() * 150))
  const off = (): number => (rand() - 0.5) * 240
  let next = 0
  let cycle: number | null = null
  let sinceBreath = 0
  let breatheEvery = 3 + Math.floor(rand() * 2)
  let turnAt = 1 + rand() * 1.2
  for (let clock = STEP; swimmer.finishMs === null && clock < 900_000; clock += STEP) {
    advance(swimmer, STEP, clock, lengths)
    if (!swimming(swimmer)) {
      next = 0
      cycle = null
      continue
    }
    if (toWall(swimmer) <= turnAt && callTurn(swimmer, lengths)) turnAt = 1 + rand() * 1.2
    next -= STEP
    if (next > 0) continue
    const wait = CYCLE_MS + off()
    next += wait
    if (sinceBreath >= breatheEvery && breathe(swimmer)) {
      sinceBreath = 0
      breatheEvery = 3 + Math.floor(rand() * 2)
    }
    stroke(swimmer, PULL_MS + off(), cycle)
    sinceBreath++
    cycle = wait
  }
  return swimmer
}

describe('Swim Race balance', () => {
  it('lets an ordinary player beat a poor swimmer and lose to a fine one, without running out of air', () => {
    for (const lengths of [2, 4, 6]) {
      const rand = seededRand(`ordinary ${lengths}`)
      const mine = Array.from({ length: 200 }, () => ordinary(lengths, rand))
      const beaten = (skill: Skill): number =>
        mine.filter((me) => (me.finishMs ?? 0) < (herRace(skill, lengths, rand).finishMs ?? 0)).length / mine.length
      expect(beaten(2)).toBeGreaterThan(0.9)
      expect(beaten(5)).toBeLessThan(0.35)
      expect(mean(mine.map((me) => me.gasps))).toBeLessThan(0.1)
      expect(mine.every((me) => me.turns.every((turn) => turn === 'good'))).toBe(true)
    }
  })

  it('lets a swimmer out of air recover: the gasping ends, with air to swim on', () => {
    const swimmer = inWater(1)
    swimmer.air = 0.01
    expect(stroke(swimmer, PULL_MS, null).emptied).toBe(true)
    expect(breathe(swimmer)).toBe(false)
    for (let clock = STEP; clock <= GASP_MS + STEP; clock += STEP) advance(swimmer, STEP, clock, 6)
    expect(swimmer.gaspMs).toBe(0)
    expect(swimmer.air).toBeGreaterThanOrEqual(0.5)
    expect(stroke(swimmer, PULL_MS, null).emptied).toBe(false)
  })
})

describe('Swim Race wording by the water', () => {
  const home = (ms: number, turns: TurnGrade[]): Swimmer => ({
    ...onBlocks(250),
    dist: 50,
    blockMs: 0,
    finishMs: ms,
    strokes: 20,
    worth: 17,
    breaths: 3,
    turns
  })
  const all = [
    { name: 'You', swimmer: home(24_500, ['late']) },
    { name: 'Ana', swimmer: home(23_900, ['good']) }
  ]

  it('knows the pool and the sea by the location, and anywhere else is just water', () => {
    expect(waterAt('palaestra_stadium')).toBe('pool')
    expect(waterAt('selkie_beach')).toBe('sea')
    expect(waterAt(null)).toBe('water')
    expect(waterAt('lowrise_dorms')).toBe('water')
  })

  it('says lengths and the pool at the stadium, and the buoy and the sea at the beach', () => {
    const pool = [raceSummary(all, 2, 'pool'), ...raceAccount(all, 2, ['Ana'], 'pool')].join('\n')
    expect(pool).toContain('2 lengths of the pool')
    expect(pool).toContain('the stadium pool')
    expect(pool).toContain('into the wall')
    expect(pool).not.toMatch(/buoy|sea/)
    const sea = [raceSummary(all, 2, 'sea'), ...raceAccount(all, 2, ['Ana'], 'sea')].join('\n')
    expect(sea).toContain('out to the buoy and back')
    expect(sea).toContain('in the sea')
    expect(sea).toContain('Ana led at the buoy')
    expect(sea).not.toMatch(/length|pool|wall|touch|blocks/)
    expect(raceSummary(all, 4, 'sea')).toContain('twice out to the buoy and back')
    expect(raceSummary(all.slice(0, 1), 6, 'sea')).toContain('three times out to the buoy and back in the sea, 150 metres')
    expect(raceAccount(all.slice(0, 1), 2, [], 'sea').join('\n')).not.toMatch(/length|pool|wall|touch|blocks/)
  })

  it('keeps to neutral words where it is told nothing', () => {
    const plain = [raceSummary(all, 2), ...raceAccount(all, 2, ['Ana'])].join('\n')
    expect(plain).toContain('over 2 lengths')
    expect(plain).not.toMatch(/buoy|sea|pool/)
  })

  it('labels a leg by the water, and names where each turn is made', () => {
    expect(legLabel(3, 4)).toBe('3/4')
    expect([1, 2].map((length) => legLabel(length, 2, 'sea'))).toEqual(['Out', 'Back'])
    expect([1, 2, 3, 4].map((length) => legLabel(length, 4, 'sea'))).toEqual(['Out 1/2', 'Back 1/2', 'Out 2/2', 'Back 2/2'])
    expect([1, 2, 3].map((length) => turnPlace(length, 'sea'))).toEqual(['the buoy', 'the shore', 'the buoy'])
    expect(turnPlace(1, 'pool')).toBe('the wall')
    expect(courseWords(6, 'pool')).toBe('over 6 lengths of the pool')
  })

  it('gives a swim alone an account of its time, its turns and its air', () => {
    const account = raceAccount(all.slice(0, 1), 2, [], 'pool').join('\n')
    expect(account).toContain('24.50')
    expect(account).toContain('one turn')
    expect(account).toContain('3 breaths')
  })
})
