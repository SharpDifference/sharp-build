import { describe, expect, it } from 'vitest'
import { seededRand } from '../src/shared/hash'
import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, settledOptions } from '../src/shared/minigames'
import ROLLER_DERBY_MOD from '../src/shared/modEntries/morrowkiln-sports'
import {
  BEAT_MS,
  DOWN_MS,
  FALL_SPEED,
  LAP_M,
  LIMIT_MS_PER_LAP,
  WINDOWS,
  account,
  advance,
  finishOut,
  inBend,
  judgeStride,
  lapsOf,
  newRace,
  outcomeOf,
  placings,
  readerLean,
  readerStride,
  rhythmShare,
  stride,
  strideReach,
  summary,
  winningGap,
  type Foot,
  type Race,
  type RaceEvent,
  type Skill
} from '../src/shared/rollerDerby'

/** Rink Race's rules: the stride, the bends, how the girls skate, the order and the account. */

const SKILLS: Skill[] = [1, 2, 3, 4, 5]
const never = (): number => {
  throw new Error('guessed')
}

/**
 * The reader skated by rote for `ms` of the clock: a push every `everyMs`, feet alternating
 * unless `oneFoot`, leaning as `leans` says of where he is.
 */
function skate(
  race: Race,
  ms: number,
  everyMs: number,
  leans: (dist: number) => boolean,
  oneFoot = false
): RaceEvent[] {
  const events: RaceEvent[] = []
  const until = race.t + ms
  let next = race.t
  let foot: Foot = 'left'
  while (race.t < until && race.skaters[0].finishedAt === null && !race.called) {
    if (race.t >= next) {
      readerStride(race, foot, next)
      if (!oneFoot) foot = foot === 'left' ? 'right' : 'left'
      next += everyMs
    }
    readerLean(race, leans(race.skaters[0].dist))
    events.push(...advance(race, 10, never))
  }
  return events
}

/** A girl's time over a race skated alone on the floor, in ms. */
function herTime(skill: Skill, seed: string, laps = 3): number {
  const race = newRace(laps, [skill])
  finishOut(race, seededRand(seed))
  return race.skaters[1].finishedAt ?? laps * LIMIT_MS_PER_LAP
}

/** A race already run, with each skater home at the time given, or not at all. */
function finished(timesMs: readonly (number | null)[]): Race {
  const race = newRace(3, timesMs.slice(1).map((): Skill => 3))
  race.skaters.forEach((skater, who) => {
    skater.finishedAt = timesMs[who]
    if (timesMs[who] !== null) skater.dist = 3 * LAP_M
  })
  race.t = Math.max(...timesMs.map((at) => at ?? 0))
  return race
}

describe('Rink Race strides', () => {
  it('judges a stride by how near the tempo it lands, early or late', () => {
    expect(judgeStride(BEAT_MS, false)).toBe('perfect')
    expect(judgeStride(BEAT_MS - WINDOWS.perfect, false)).toBe('perfect')
    expect(judgeStride(BEAT_MS + WINDOWS.perfect + 1, false)).toBe('good')
    expect(judgeStride(BEAT_MS - WINDOWS.good - 1, false)).toBe('rough')
    expect(judgeStride(BEAT_MS + WINDOWS.rough + 1, false)).toBe('off')
    expect(judgeStride(120, false)).toBe('off')
  })

  it('counts the same foot twice against the skater, except as a fresh push-off', () => {
    expect(judgeStride(BEAT_MS, true)).toBe('same')
    expect(judgeStride(null, true)).toBe('good')
    expect(judgeStride(2000, true)).toBe('good')

    const race = newRace(3, [])
    const me = race.skaters[0]
    stride(me, 'left', 0)
    stride(me, 'right', BEAT_MS)
    const before = me.speed
    expect(stride(me, 'right', 2 * BEAT_MS)).toBe('same')
    expect(me.speed).toBeLessThan(before)
  })

  it('gives an early stride less of a push, and a down or finished skater none', () => {
    expect(strideReach(BEAT_MS)).toBe(1)
    expect(strideReach(BEAT_MS * 2)).toBe(1)
    expect(strideReach(BEAT_MS / 2)).toBeLessThan(0.5)

    const race = newRace(3, [])
    race.skaters[0].downMs = DOWN_MS
    expect(readerStride(race, 'left')).toBeNull()
    expect(race.skaters[0].strides.good).toBe(0)
  })

  it('carries a steady tempo further than hammering, dawdling or hopping on one foot', () => {
    const straight = (): boolean => false
    const run = (everyMs: number, oneFoot = false): number => {
      // A straight is all that is skated: the first bend is 12.5 m off and never reached in time.
      const race = newRace(6, [])
      skate(race, 1400, everyMs, straight, oneFoot)
      return race.skaters[0].speed
    }
    const steady = run(BEAT_MS)
    expect(steady).toBeGreaterThan(run(130))
    expect(steady).toBeGreaterThan(run(BEAT_MS - 120))
    expect(steady).toBeGreaterThan(run(BEAT_MS + 200))
    expect(steady).toBeGreaterThan(run(BEAT_MS, true))
  })
})

describe('Rink Race bends', () => {
  it('has two bends a lap, with the line in the middle of a straight', () => {
    expect(inBend(0)).toBe(false)
    expect(inBend(12)).toBe(false)
    expect(inBend(13)).toBe(true)
    expect(inBend(37)).toBe(true)
    expect(inBend(50)).toBe(false)
    expect(inBend(70)).toBe(true)
    expect(inBend(95)).toBe(false)
    expect(inBend(LAP_M + 20)).toBe(true)
  })

  it('keeps a leaning skater on the line and on his feet for a whole race', () => {
    const race = newRace(3, [])
    const events = skate(race, 90000, BEAT_MS, inBend)
    const me = race.skaters[0]
    expect(me.finishedAt).not.toBeNull()
    expect(me.falls).toHaveLength(0)
    expect(me.wide).toBe(0)
    expect(events.filter((event) => event.kind === 'lap')).toHaveLength(2)
    expect(events.filter((event) => event.kind === 'finish')).toHaveLength(1)
    expect(rhythmShare(me.strides)).toBe(1)
  })

  it('throws a fast skater who does not lean, holds him down, and costs him the race', () => {
    const leaning = newRace(3, [])
    skate(leaning, 90000, BEAT_MS, inBend)
    const upright = newRace(3, [])
    const events = skate(upright, 90000, BEAT_MS, () => false)
    const me = upright.skaters[0]
    expect(events.some((event) => event.kind === 'fall' && event.who === 0)).toBe(true)
    expect(me.falls[0].lap).toBe(1)
    expect(me.finishedAt ?? Infinity).toBeGreaterThan((leaning.skaters[0].finishedAt as number) + DOWN_MS)

    // Down, he goes nowhere and cannot push.
    const race = newRace(3, [])
    const fell = skate(race, 20000, BEAT_MS, () => false).findIndex((event) => event.kind === 'fall')
    expect(fell).toBeGreaterThanOrEqual(0)
  })

  it('lets a slow skater off with a wobble at the boards', () => {
    const race = newRace(3, [])
    const events = skate(race, 30000, 800, () => false)
    expect(race.skaters[0].speed).toBeLessThan(FALL_SPEED)
    expect(events.some((event) => event.kind === 'wobble')).toBe(true)
    expect(events.some((event) => event.kind === 'fall')).toBe(false)
  })

  it('costs time to crouch all the way round, and to lean late', () => {
    const time = (leans: (dist: number) => boolean): number => {
      const race = newRace(3, [])
      skate(race, 90000, BEAT_MS, leans)
      return race.skaters[0].finishedAt ?? Infinity
    }
    const clean = time(inBend)
    expect(time(() => true)).toBeGreaterThan(clean)
    expect(time((dist) => inBend(dist - 4))).toBeGreaterThan(clean)
  })
})

describe('Rink Race girls', () => {
  it('skates the same race from the same seed', () => {
    expect(herTime(3, 'seed')).toBe(herTime(3, 'seed'))
    expect(herTime(3, 'seed')).not.toBe(herTime(3, 'other'))
  })

  it('brings every girl home inside the limit, the better ones sooner', () => {
    const mean = (skill: Skill): number => {
      let sum = 0
      for (let i = 0; i < 60; i++) {
        const at = herTime(skill, `run:${i}`)
        expect(at).toBeLessThan(3 * LIMIT_MS_PER_LAP)
        sum += at
      }
      return sum / 60
    }
    const means = SKILLS.map(mean)
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeLessThan(means[i - 1] - 1000)
    // The best is near what a faultless run takes, and no better.
    const faultless = newRace(3, [])
    skate(faultless, 90000, BEAT_MS, inBend)
    expect(means[4]).toBeGreaterThan(faultless.skaters[0].finishedAt as number)
  })

  it('has the weak skaters lose their line and fall more than the strong ones', () => {
    const slips = (skill: Skill): number => {
      let sum = 0
      for (let i = 0; i < 150; i++) {
        const race = newRace(3, [skill])
        finishOut(race, seededRand(`slips:${i}`))
        sum += race.skaters[1].falls.length + race.skaters[1].wobbles + race.skaters[1].wide
      }
      return sum
    }
    expect(slips(1)).toBeGreaterThan(slips(3))
    expect(slips(3)).toBeGreaterThan(slips(5))
  })

  it('counts the lead changing hands, and who was first over the line each lap', () => {
    const race = newRace(2, [1])
    const rand = seededRand('lead')
    // The reader stands on the line while she gets away, then skates her down.
    while (race.skaters[1].dist < 30) advance(race, 10, rand)
    expect(race.leader).toBe(1)
    expect(race.leadChanges).toHaveLength(0)
    let foot: Foot = 'left'
    let next = race.t
    const events: RaceEvent[] = []
    while (race.skaters[0].finishedAt === null && !race.called) {
      if (race.t >= next) {
        readerStride(race, foot, next)
        foot = foot === 'left' ? 'right' : 'left'
        next += BEAT_MS
      }
      readerLean(race, inBend(race.skaters[0].dist))
      events.push(...advance(race, 10, rand))
    }
    finishOut(race, rand)
    const leads = events.filter((event) => event.kind === 'lead')
    expect(leads.length).toBe(race.leadChanges.length)
    expect(race.lapLeaders).toHaveLength(1)
    if (outcomeOf(race) === 'won') expect(race.leadChanges.at(-1)?.to).toBe(0)
  })
})

describe('Rink Race result', () => {
  it('places by time, shares a place on the same hundredth, and puts anyone not home last', () => {
    const race = finished([35004, 34000, 35001, null])
    expect(placings(race).map((placing) => [placing.who, placing.place])).toEqual([
      [1, 1],
      [0, 2],
      [2, 2],
      [3, 4]
    ])
    expect(outcomeOf(race)).toBe('lost')
    expect(winningGap(race)).toBe(1004)
  })

  it('gives the reader the race only when he is alone in front', () => {
    expect(outcomeOf(finished([34000, 34500, 36000]))).toBe('won')
    expect(outcomeOf(finished([34002, 34004, 36000]))).toBe('draw')
    expect(outcomeOf(finished([34500, 34000]))).toBe('lost')
    expect(outcomeOf(finished([null, null]))).toBe('lost')
    expect(outcomeOf(finished([34000]))).toBe('played')
  })

  it('calls time on a skater who never comes home', () => {
    const race = newRace(2, [3])
    const events: RaceEvent[] = []
    const rand = seededRand('called')
    while (!race.called) events.push(...advance(race, 50, rand))
    expect(race.t).toBeGreaterThanOrEqual(2 * LIMIT_MS_PER_LAP)
    expect(events.at(-1)).toEqual({ kind: 'called' })
    expect(race.skaters[1].finishedAt).not.toBeNull()
    expect(outcomeOf(race)).toBe('lost')
    expect(advance(race, 50, never)).toEqual([])
  })

  it('names everyone in the summary and the account, and says who fell', () => {
    const names = ['Ana', 'Bea', 'Cy']
    const race = newRace(3, [2, 3, 4])
    const rand = seededRand('account')
    let foot: Foot = 'left'
    let next = 0
    while (race.skaters[0].finishedAt === null && !race.called) {
      if (race.t >= next) {
        readerStride(race, foot, next)
        foot = foot === 'left' ? 'right' : 'left'
        next += BEAT_MS + 40
      }
      // He forgets the first bend, and remembers the rest.
      readerLean(race, race.skaters[0].dist > 40 && inBend(race.skaters[0].dist))
      advance(race, 10, rand)
    }
    finishOut(race, rand)
    const told = account(race, names).join('\n')
    const said = summary(race, names)
    for (const name of names) {
      expect(told).toContain(name)
      expect(said).toContain(name)
    }
    expect(told).toContain('the reader')
    expect(told).not.toContain('You')
    expect(said.startsWith('You ')).toBe(true)
    expect(race.skaters[0].falls.length + race.skaters[0].wobbles).toBeGreaterThan(0)
    expect(told).toMatch(/the reader (on lap 1|.*wobbled|.*ran wide)/)
    expect(told).toContain('out of breath')

    const alone = newRace(2, [])
    skate(alone, 90000, BEAT_MS, inBend)
    expect(outcomeOf(alone)).toBe('played')
    expect(account(alone, []).join('\n')).toContain('alone')
    expect(summary(alone, []).startsWith('You ')).toBe(true)
  })
})

describe('Rink Race on paper', () => {
  const game = MINI_GAMES_LIST.find((entry) => entry.id === 'roller-derby')

  it('is offered at the roller rink and nowhere else, alone or with up to three girls', () => {
    expect(game).toBeDefined()
    if (!game) return
    const on = (): boolean => true
    expect(gamesOffered({ location: 'roller_rink', girls: 0 }, on, [game])).toEqual([game])
    expect(gamesOffered({ location: 'roller_rink', girls: 3 }, on, [game])).toEqual([game])
    expect(gamesOffered({ location: 'bowling_alley', girls: 1 }, on, [game])).toEqual([])
    expect(gamesOffered({ location: null, girls: 1 }, on, [game])).toEqual([])
    expect(gamesOffered({ location: 'roller_rink', girls: 1 }, () => false, [game])).toEqual([])
    expect(game.players).toEqual({ min: 0, max: 3 })
    expect(game.modId).toBe(ROLLER_DERBY_MOD.id)
    expect(ROLLER_DERBY_MOD.requires).toContain(MINI_GAMES)
  })

  it('plays every number of laps it offers, and three where nothing was said', () => {
    if (!game) return
    expect(settledOptions(game, {}).laps).toBe(3)
    expect(settledOptions(game, { laps: 9 }).laps).toBe(3)
    for (let laps = 2; laps <= 6; laps++) {
      expect(lapsOf(settledOptions(game, { laps }).laps)).toBe(laps)
      expect(newRace(laps, []).laps).toBe(laps)
    }
    expect(lapsOf(undefined)).toBe(3)
    expect(lapsOf(40)).toBe(6)
  })
})
