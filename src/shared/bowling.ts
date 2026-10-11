/** Bowling's rules: the lane, a throw, which pins it takes, the scoring and how she throws. */

/** Half the lane's width, in inches: everything across the lane is measured from its middle. */
export const LANE_HALF = 20.75

/** How far either side of the middle the ball may be set down at the foul line. */
export const START_REACH = 17

export interface Pin {
  /** 1 to 10, as a bowler numbers them: the head pin is 1, the back row 7 to 10. */
  id: number
  /** Inches right of the lane's middle. */
  x: number
  /** 0 for the head pin's row to 3 for the back row. */
  row: number
}

/** The ten pins in their triangle, a foot between neighbours. */
export const PINS: readonly Pin[] = [0, 1, 2, 3].flatMap((row) =>
  Array.from({ length: row + 1 }, (_, i): Pin => ({ id: 0, x: (i - row / 2) * 12, row }))
).map((pin, i) => ({ ...pin, id: i + 1 }))

/** A full rack. */
export const ALL_PINS: readonly number[] = PINS.map((pin) => pin.id)

/** A throw as it is made: three things, each stopped by hand. */
export interface Throw {
  /** Where the ball is set down along the foul line, -1 (far left) to 1 (far right). */
  position: number
  /** 0 (a dribble) to 1 (everything she has). */
  power: number
  /** The curve put on it, -1 (hard left) to 1 (hard right). */
  hook: number
}

/** Where a throw ends up when it reaches the pins. */
export interface Path {
  /** Inches right of the middle as it reaches the head pin's row. */
  arriveX: number
  /** How hard it is still moving sideways: inches across per row of pins, over {@link DRIFT}. */
  angle: number
  /** It left the lane before the pins. */
  gutter: boolean
}

/** The most a full hook moves a slow ball across the lane, in inches. */
const HOOK_INCHES = 9
/** How far across one row of pins a ball at angle 1 drifts, in inches. */
export const DRIFT = 2.2

/** How much of its hook a ball keeps at this power: a hard ball skids straighter. */
function bite(power: number): number {
  return 1.25 - 0.5 * power
}

/** A throw's line down the lane: `along` is 0 at the foul line and 1 at the head pin. */
export function ballX(thrown: Throw, along: number): number {
  const x =
    thrown.position * START_REACH + thrown.hook * HOOK_INCHES * bite(thrown.power) * along * along
  // Past the edge it is in the gutter, and stays there.
  return Math.abs(x) > LANE_HALF ? Math.sign(x) * (LANE_HALF + 2.6) : x
}

export function pathOf(thrown: Throw): Path {
  const raw = thrown.position * START_REACH + thrown.hook * HOOK_INCHES * bite(thrown.power)
  return { arriveX: raw, angle: thrown.hook * bite(thrown.power), gutter: Math.abs(raw) > LANE_HALF }
}

/** How near a pin's middle the ball's must pass to hit it. */
const REACH = 5.8

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/**
 * Which pins a ball takes. The ball goes through the rack a row at a time, knocking what is in
 * its reach and glancing off it; every pin that falls is thrown the way it was struck and may
 * take the pin behind it on that side, and so on down the rack. A ball into the pocket sends the
 * head pin one way and goes the other itself, which is the whole rack; one dead on the head pin
 * sends it nowhere in particular and leaves the corners; one out at the edge has nothing behind
 * what it hits. A soft ball carries less and is pushed about more.
 */
export function resolvePins(
  arriveX: number,
  angle: number,
  power: number,
  standing: readonly number[],
  rand: () => number = Math.random
): number[] {
  if (Math.abs(arriveX) > LANE_HALF) return []
  const up = new Set(standing)
  const down: number[] = []
  /** Each fallen pin and the way it was sent: -1 hard left to 1 hard right. */
  const sent: { pin: Pin; lean: number }[] = []
  const fell = (pin: Pin, lean: number): void => {
    if (!up.delete(pin.id)) return
    down.push(pin.id)
    sent.push({ pin, lean })
  }
  const carry = 0.5 + 0.47 * Math.min(1, power / 0.8)

  let x = arriveX
  for (let row = 0; row < 4; row++) {
    for (const pin of PINS) {
      if (pin.row !== row || !up.has(pin.id)) continue
      const off = (pin.x - x) / REACH
      if (Math.abs(off) >= 1) continue
      fell(pin, off)
      // A glancing hit turns the ball the other way; a full one does not turn it at all.
      x -= Math.sign(off) * 4 * Math.abs(off) * (1 - Math.abs(off)) * 2 * (1.3 - power)
    }
    x += angle * DRIFT
  }

  for (let i = 0; i < sent.length; i++) {
    const { pin, lean } = sent[i]
    for (const side of [-1, 1]) {
      const behind = PINS.find((p) => p.row === pin.row + 1 && p.x === pin.x + side * 6)
      if (!behind || !up.has(behind.id)) continue
      if (rand() < carry * clamp(0.58 + 1.1 * lean * side, 0.04, 1)) fell(behind, side * 0.55)
    }
    // Now and then a pin goes off across the deck and takes one nobody aimed at.
    if (up.size > 0 && rand() < 0.07 * carry) {
      const left = PINS.filter((p) => up.has(p.id))
      const struck = left[Math.floor(rand() * left.length)]
      fell(struck, rand() < 0.5 ? -0.5 : 0.5)
    }
  }
  return down.sort((a, b) => a - b)
}

/**
 * Whether what is left standing is a split: the head pin is down and the pins left are in two
 * groups or more with a gap between them.
 */
export function isSplit(standing: readonly number[]): boolean {
  if (standing.length < 2 || standing.includes(1)) return false
  const left = PINS.filter((pin) => standing.includes(pin.id))
  const group = new Set([left[0].id])
  for (let grew = true; grew; ) {
    grew = false
    for (const pin of left) {
      if (group.has(pin.id)) continue
      const near = left.some(
        (other) =>
          group.has(other.id) && Math.hypot(pin.x - other.x, (pin.row - other.row) * 10.4) < 12.5
      )
      if (near) {
        group.add(pin.id)
        grew = true
      }
    }
  }
  return group.size < left.length
}

/** Whether a throw was a good one for the pins it was thrown at, whatever came of it. */
export function wellAimed(thrown: Throw, standing: readonly number[]): boolean {
  const path = pathOf(thrown)
  if (path.gutter || thrown.power < 0.45) return false
  // A full rack: into either pocket, just off the head pin.
  if (standing.length === 10) return Math.abs(path.arriveX) >= 1.5 && Math.abs(path.arriveX) <= 4.8
  // A leave: the ball's line passes close to the middle of a pin that is there.
  return PINS.some(
    (pin) =>
      standing.includes(pin.id) &&
      Math.abs(path.arriveX + path.angle * DRIFT * pin.row - pin.x) < 3.2
  )
}

/** How a girl bowls, from 1 (hopes for the best) to 5 (league night). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** How far her hand strays from what she meant, by skill: along the line, in power, in hook. */
const STRAY: Record<Skill, { position: number; power: number; hook: number }> = {
  1: { position: 0.9, power: 0.22, hook: 0.7 },
  2: { position: 0.55, power: 0.16, hook: 0.38 },
  3: { position: 0.27, power: 0.12, hook: 0.15 },
  4: { position: 0.14, power: 0.08, hook: 0.09 },
  5: { position: 0.08, power: 0.05, hook: 0.05 }
}

/** A draw from a bell curve about zero, from two of the injected random's. */
function bell(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand() * 0.999999)) * Math.cos(2 * Math.PI * rand())
}

/**
 * Her throw at the pins standing. She means the same thing every time: at a full rack the
 * pocket, with a hook once she is good enough to have one, and at a leave the front pin of it,
 * leaning toward the rest. What skill buys is how near her hand comes to what she meant.
 */
export function herThrow(
  standing: readonly number[],
  skill: Skill,
  rand: () => number = Math.random
): Throw {
  const left = PINS.filter((pin) => standing.includes(pin.id))
  const full = left.length === 10 || left.length === 0
  const hook = full && skill >= 3 ? -0.45 : 0
  const power = skill >= 3 ? 0.78 : skill === 2 ? 0.62 : 0.5
  const front = left.filter((pin) => pin.row === Math.min(...left.map((p) => p.row)))
  const mean = (pins: readonly Pin[]): number =>
    pins.reduce((sum, pin) => sum + pin.x, 0) / Math.max(1, pins.length)
  const target = full ? 3 : mean(front) * 0.75 + mean(left) * 0.25
  const meant = (target - hook * HOOK_INCHES * bite(power)) / START_REACH
  const stray = STRAY[skill]
  return {
    position: clamp(meant + bell(rand) * stray.position, -1, 1),
    power: clamp(power + bell(rand) * stray.power, 0.05, 1),
    hook: clamp(hook + bell(rand) * stray.hook, -1, 1)
  }
}

/** Where a bowler stands in her own game, from the pins each of her balls took. */
export interface Rack {
  /** The frame she is on, from 0; the number of frames once she is done. */
  frame: number
  /** Which ball of that frame is next, from 0. */
  ball: number
  /** The next ball is at a full rack. */
  fresh: boolean
  done: boolean
}

/**
 * Where `rolls` leaves a bowler in a game of `frames` frames. Two balls a frame unless the first
 * is a strike; the last frame gives a third for a strike or a spare.
 */
export function rackOf(rolls: readonly number[], frames: number): Rack {
  let i = 0
  for (let frame = 0; frame < frames - 1; frame++) {
    if (i >= rolls.length) return { frame, ball: 0, fresh: true, done: false }
    if (rolls[i] === 10) i += 1
    else if (i + 1 >= rolls.length) return { frame, ball: 1, fresh: false, done: false }
    else i += 2
  }
  const last = rolls.slice(i)
  const frame = frames - 1
  if (last.length === 0) return { frame, ball: 0, fresh: true, done: false }
  if (last.length === 1) return { frame, ball: 1, fresh: last[0] === 10, done: false }
  const earned = last[0] === 10 || last[0] + last[1] === 10
  if (last.length === 2 && earned) {
    return { frame, ball: 2, fresh: last[0] < 10 || last[1] === 10, done: false }
  }
  return { frame: frames, ball: 0, fresh: true, done: true }
}

/** One frame on the scoresheet. */
export interface FrameScore {
  /** Each ball as it is marked: a count, X for a strike, / for a spare, – for nothing. */
  marks: string[]
  /** The running total through this frame, once every ball it counts has been thrown. */
  total: number | null
  /** The same with whatever is still owed counted as nothing: how it stands right now. */
  sofar: number
}

/** A bowler's scoresheet: every frame of the game, the ones not reached yet empty. */
export function sheetOf(rolls: readonly number[], frames: number): FrameScore[] {
  const sheet: FrameScore[] = []
  const at = (i: number): number => rolls[i] ?? 0
  let i = 0
  let running = 0
  let settled = true
  for (let frame = 0; frame < frames; frame++) {
    const lastFrame = frame === frames - 1
    const strike = rolls[i] === 10
    const spare = !strike && i + 1 < rolls.length && at(i) + at(i + 1) === 10
    // The last frame is scored on its own balls; an earlier one borrows from what follows.
    const taken = lastFrame ? (strike || spare ? 3 : 2) : strike ? 1 : 2
    const counted = lastFrame ? taken : strike || spare ? 3 : 2
    const mine = rolls.slice(i, i + taken)

    const marks: string[] = []
    let left = 10
    // A ball at a full rack: all ten of it is a strike, where all of a leave is a spare.
    let fresh = true
    for (const roll of mine) {
      if (roll === left) {
        marks.push(fresh ? 'X' : '/')
        left = 10
        fresh = true
      } else {
        marks.push(roll === 0 ? '–' : String(roll))
        left -= roll
        fresh = false
      }
    }

    for (let k = 0; k < counted; k++) running += at(i + k)
    settled = settled && mine.length > 0 && i + counted <= rolls.length
    sheet.push({ marks, total: settled ? running : null, sofar: running })
    i += taken
  }
  return sheet
}

/** What a bowler has on the sheet right now. */
export function totalOf(rolls: readonly number[], frames: number): number {
  return sheetOf(rolls, frames)[frames - 1].sofar
}

/** One ball of a game: who threw it, how, at what, and what fell. */
export interface Ball {
  hers: boolean
  thrown: Throw
  /** The pins standing as it was thrown. */
  before: readonly number[]
  fallen: readonly number[]
}

/** The pins each ball of one bowler's took, in order. */
export function rollsOf(balls: readonly Ball[], hers: boolean): number[] {
  return balls.filter((ball) => ball.hers === hers).map((ball) => ball.fallen.length)
}

/** How a game stands between balls. */
export interface Table {
  /** Whose ball is next. */
  hers: boolean
  /** The pins she or he is throwing at. */
  standing: readonly number[]
  /** The frame that ball belongs to, from 0, and which ball of it. */
  frame: number
  ball: number
  over: boolean
}

/**
 * How a game stands after `balls`. Alone the reader bowls every frame; against her they take
 * alternate frames, the reader first.
 */
export function tableOf(balls: readonly Ball[], frames: number, versus: boolean): Table {
  const mine = rackOf(rollsOf(balls, false), frames)
  const other = rackOf(rollsOf(balls, true), frames)
  const hers = versus && (mine.done || mine.frame > other.frame)
  const rack = hers ? other : mine
  const last = [...balls].reverse().find((ball) => ball.hers === hers)
  const standing =
    rack.fresh || !last ? ALL_PINS : last.before.filter((pin) => !last.fallen.includes(pin))
  return {
    hers,
    standing,
    frame: Math.min(rack.frame, frames - 1),
    ball: rack.ball,
    over: mine.done && (!versus || other.done)
  }
}

/** What kind of ball one was, the most telling thing about it first. */
export type BallKind =
  | 'turkey'
  | 'strike'
  | 'split-converted'
  | 'spare'
  | 'gutter'
  | 'split'
  | 'miss'
  | 'count'

/** One ball as it is told. */
export interface BallTold {
  kind: BallKind
  /** The frame it was thrown in, from 0. */
  frame: number
  /** It was the last ball of its frame. */
  closed: boolean
  /** For the scene's dialogue box ("You ..."). */
  narration: string
  /** For her, as a plain account of what just happened ("The reader ..."). */
  cue: string
  /** Worth a remark from her. */
  notable: boolean
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** The pins left, as a bowler names a leave: "the 7-10". */
function leaveName(standing: readonly number[]): string {
  return `the ${[...standing].sort((a, b) => a - b).join('-')}`
}

/**
 * Ball `i` of a game, told: what it was, in the narration's words and in a cue for her. `name`
 * is what the reader calls her; unused in a game played alone.
 */
export function ballTold(name: string, balls: readonly Ball[], i: number, frames: number): BallTold {
  const ball = balls[i]
  const side = balls.slice(0, i + 1).filter((other) => other.hers === ball.hers)
  const rolls = side.map((other) => other.fallen.length)
  const rack = rackOf(rolls.slice(0, -1), frames)
  const after = rackOf(rolls, frames)
  const took = ball.fallen.length
  const left = ball.before.filter((pin) => !ball.fallen.includes(pin))
  const cleared = left.length === 0
  const full = ball.before.length === 10
  let run = 0
  for (let k = side.length - 1; k >= 0 && side[k].before.length === 10 && side[k].fallen.length === 10; k--) run++

  const kind: BallKind =
    full && cleared
      ? run >= 3
        ? 'turkey'
        : 'strike'
      : cleared
        ? isSplit(ball.before)
          ? 'split-converted'
          : 'spare'
        : pathOf(ball.thrown).gutter
          ? 'gutter'
          : full && isSplit(left)
            ? 'split'
            : took === 0
              ? 'miss'
              : 'count'

  const closed = after.done || after.frame > rack.frame
  const frameTook = full ? took : 10 - left.length
  const texts = (who: string, whose: string, s: string): string => {
    switch (kind) {
      case 'turkey':
        return `${who} bowl${s} a third strike running: a turkey!`
      case 'strike':
        return run === 2 ? `${who} bowl${s} another strike: two in a row.` : `${who} bowl${s} a strike!`
      case 'split-converted':
        return `${who} convert${s} ${leaveName(ball.before)} split for a spare!`
      case 'spare':
        return `${who} pick${s} up the spare.`
      case 'gutter':
        return `${whose} ball drops into the gutter.`
      case 'split':
        return `${who} take${s} ${took} and leave${s} ${leaveName(left)} split.`
      case 'miss':
        return full ? `${whose} ball slides past everything.` : `${who} miss${s ? 'es' : ''} what was left.`
      default:
        return full
          ? `${who} knock${s} down ${took}.`
          : `${who} take${s} ${took} more: ${frameTook} for the frame.`
    }
  }
  const total = totalOf(rolls, frames)
  const tally = (who: string, has: string): string =>
    closed ? ` ${who} ${has} ${total} after ${ORDINAL[rack.frame] ? `the ${ORDINAL[rack.frame]} frame` : `frame ${rack.frame + 1}`}.` : ''
  return {
    kind,
    frame: rack.frame,
    closed,
    narration: ball.hers
      ? texts(name, `${name}'s`, 's') + tally(name, 'has')
      : texts('You', 'Your', '') + tally('You', 'have'),
    cue: ball.hers
      ? texts(name, `${name}'s`, 's') + tally(name, 'has')
      : texts('The reader', "The reader's", 's') + tally('The reader', 'has'),
    notable: ['turkey', 'strike', 'split-converted', 'gutter'].includes(kind)
  }
}

/**
 * What to tell her as the last frame begins with the game still open: both have every frame but
 * the last on the sheet and are within a strike or so of each other. Null at any other moment.
 */
export function lastFrameCue(name: string, balls: readonly Ball[], frames: number): string | null {
  if (frames < 2) return null
  const mine = rollsOf(balls, false)
  const other = rollsOf(balls, true)
  const a = rackOf(mine, frames)
  const b = rackOf(other, frames)
  if (a.frame !== frames - 1 || b.frame !== frames - 1 || a.ball !== 0 || b.ball !== 0) return null
  const [x, y] = [totalOf(mine, frames), totalOf(other, frames)]
  if (Math.abs(x - y) > 20) return null
  return `One frame left and it will decide the game: the reader has ${x}, ${name} has ${y}.`
}

/** A bowler's game in counts. */
export interface Tally {
  total: number
  strikes: number
  spares: number
  gutters: number
  splits: number
  /** Balls thrown, and how many of them were good throws for what stood. */
  balls: number
  aimed: number
  /** Strikes off throws that were not good ones. */
  lucky: number
  /** Good throws at a full rack that left pins standing. */
  robbed: number
}

export function tallyOf(balls: readonly Ball[], hers: boolean, frames: number): Tally {
  const side = balls.filter((ball) => ball.hers === hers)
  const full = (ball: Ball): boolean => ball.before.length === 10
  const cleared = (ball: Ball): boolean => ball.fallen.length === ball.before.length
  const good = (ball: Ball): boolean => wellAimed(ball.thrown, ball.before)
  const count = (test: (ball: Ball) => boolean): number => side.filter(test).length
  return {
    total: totalOf(side.map((ball) => ball.fallen.length), frames),
    strikes: count((ball) => full(ball) && cleared(ball)),
    spares: count((ball) => !full(ball) && cleared(ball)),
    gutters: count((ball) => pathOf(ball.thrown).gutter),
    splits: count((ball) => full(ball) && isSplit(ball.before.filter((pin) => !ball.fallen.includes(pin)))),
    balls: side.length,
    aimed: count(good),
    lucky: count((ball) => full(ball) && cleared(ball) && !good(ball)),
    robbed: count((ball) => full(ball) && !cleared(ball) && good(ball))
  }
}

const times = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** What a game played alone comes to, as the scene's narration says it. */
export function soloSummary(balls: readonly Ball[], frames: number): string {
  const tally = tallyOf(balls, false, frames)
  const said = `You bowl ${times(frames, 'frame')} on your own and finish on ${tally.total}`
  if (tally.total === frames * 30) return `${said}: nothing but strikes, a perfect game.`
  const marks = [
    ...(tally.strikes ? [times(tally.strikes, 'strike')] : []),
    ...(tally.spares ? [times(tally.spares, 'spare')] : [])
  ]
  if (marks.length > 0) return `${said}, with ${marks.join(' and ')}.`
  return tally.gutters > 1 ? `${said}. The gutters saw a lot of you.` : `${said}.`
}

/** What a game against her comes to, as the scene's narration says it. */
export function versusSummary(name: string, mine: number, hers: number): string {
  if (mine > hers) return `You bowl against ${name} and win, ${mine} to ${hers}.`
  if (mine < hers) return `You bowl against ${name} and lose, ${mine} to ${hers}.`
  return `You bowl against ${name} and it ends level, ${mine} each.`
}

/** One bowler's frame as the account tells it: its marks, and anything about how it was thrown. */
function frameTold(side: readonly Ball[], rolls: readonly number[], frame: number, frames: number): string {
  const marks = sheetOf(rolls, frames)[frame].marks
  const notes: string[] = []
  let at = 0
  side.forEach((ball, k) => {
    if (rackOf(rolls.slice(0, k), frames).frame !== frame) return
    const full = ball.before.length === 10
    const left = ball.before.filter((pin) => !ball.fallen.includes(pin))
    const good = wellAimed(ball.thrown, ball.before)
    if (pathOf(ball.thrown).gutter) notes.push('a gutter ball')
    else if (full && left.length === 0) notes.push(good ? 'a strike off a good ball' : 'a strike off a loose ball: lucky')
    else if (!full && left.length === 0) notes.push(isSplit(ball.before) ? `converted ${leaveName(ball.before)} split` : 'a spare')
    else if (full && isSplit(left)) notes.push(`left ${leaveName(left)} split${good ? ' off a good ball: unlucky' : ''}`)
    else if (full && good) notes.push(`a good ball that left ${times(left.length, 'pin')}: unlucky`)
    else if (full && ball.fallen.length <= 4) notes.push('a sloppy ball')
    at++
  })
  return at === 0 ? 'nothing' : `${marks.join(' ')}${notes.length ? ` (${notes.join(', ')})` : ''}`
}

/**
 * How a game against her went, for the scene's writer: each frame for each of them with what was
 * worth telling in it, how the score ran and who led, what each threw in strikes, spares and
 * gutter balls, and how much of it was aim and how much was luck.
 */
export function versusAccount(name: string, balls: readonly Ball[], frames: number): string[] {
  const sides = [false, true].map((hers) => {
    const side = balls.filter((ball) => ball.hers === hers)
    const rolls = side.map((ball) => ball.fallen.length)
    return { side, rolls, sheet: sheetOf(rolls, frames), tally: tallyOf(balls, hers, frames) }
  })
  const [mine, other] = sides
  const lines = Array.from(
    { length: frames },
    (_, frame) =>
      `Frame ${frame + 1}: the reader ${frameTold(mine.side, mine.rolls, frame, frames)}; ${name} ${frameTold(other.side, other.rolls, frame, frames)}. Running score ${mine.sheet[frame].sofar} to ${other.sheet[frame].sofar}.`
  )

  const leads = Array.from({ length: frames }, (_, frame) =>
    Math.sign(mine.sheet[frame].sofar - other.sheet[frame].sofar)
  )
  const held = leads.filter((lead) => lead !== 0)
  const changes = held.filter((lead, k) => k > 0 && lead !== held[k - 1]).length
  const led =
    held.length === 0
      ? 'They were level after every frame.'
      : changes === 0
        ? `${held[0] > 0 ? 'The reader' : name} led from the first frame that separated them to the end.`
        : `The lead changed hands ${times(changes, 'time')}; ${held[held.length - 1] > 0 ? 'the reader' : name} had it last.`

  const counts = (who: string, tally: Tally): string =>
    `${who}: ${times(tally.strikes, 'strike')}, ${times(tally.spares, 'spare')}, ${times(tally.gutters, 'gutter ball')}${tally.splits ? `, ${times(tally.splits, 'split')} left` : ''}.`
  const aim = (who: string, tally: Tally): string => {
    const share = tally.balls ? tally.aimed / tally.balls : 0
    const how = share >= 0.65 ? 'threw well all game' : share >= 0.35 ? 'was hit and miss with the aim' : 'threw sloppily'
    const luck = [
      ...(tally.lucky ? [`${times(tally.lucky, 'strike')} came off loose balls, which was luck`] : []),
      ...(tally.robbed ? [`${times(tally.robbed, 'good ball')} left pins standing, which was bad luck`] : [])
    ]
    return `${who} ${how}: ${tally.aimed} of ${times(tally.balls, 'ball')} well aimed${luck.length ? `; ${luck.join('; ')}` : ''}.`
  }

  const [a, b] = [mine.tally.total, other.tally.total]
  const gap = Math.abs(a - b)
  const close = gap === 0 ? 'dead level' : gap <= 5 ? 'as close as it gets' : gap <= 15 ? 'a close game' : gap <= 40 ? 'a clear win' : 'not close at all'
  return [
    `They bowled ${times(frames, 'frame')} each, taking alternate frames, the reader first, scored as ten-pin is: a strike counts the next two balls as well, a spare the next one.`,
    ...lines,
    led,
    counts('The reader', mine.tally),
    counts(name, other.tally),
    aim('The reader', mine.tally),
    aim(name, other.tally),
    `Final score: the reader ${a}, ${name} ${b}: ${a === b ? 'a draw' : `${a > b ? 'the reader' : name} won by ${gap}`}, ${close}.`
  ]
}
