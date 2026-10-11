import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  DRIFT,
  LANE_HALF,
  PINS,
  START_REACH,
  ballTold,
  ballX,
  herThrow,
  lastFrameCue,
  pathOf,
  resolvePins,
  rollsOf,
  sheetOf,
  soloSummary,
  tableOf,
  totalOf,
  versusAccount,
  versusSummary,
  type Ball,
  type BallTold,
  type Throw
} from '@shared/bowling'
import { gestures, lift, press } from '../views/motion'
import type { GamePlay } from './play'
import '../vu_styles/Bowling.css'

/** How many times in a game she says something about a ball, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 8 } as const

/** How long she takes over a ball: long enough for the reader's own to be read first. */
const HER_PAUSE_MS = 1700
/** How long the pins stand as they fell before the rack is reset. */
const SETTLE_MS = 800
/** Two stops closer together than this are one press, heard twice. */
const PRESS_GAP_MS = 180

/** The three things a throw is made of, in the order they are stopped, and each one's sweep. */
const STAGES = [
  { label: 'Set your spot', sweepMs: 1500 },
  { label: 'Set the power', sweepMs: 1000 },
  { label: 'Set the hook', sweepMs: 1100 }
] as const

/** The lane as it is drawn, in inches across and a shortened run to the pins. */
const VIEW = { half: LANE_HALF + 5.5, height: 140 }
const HEAD_Y = 40
const ROW_Y = 10.4
const START_Y = 131
const pinY = (row: number): number => HEAD_Y - row * ROW_Y

/** A sweep back and forth between 0 and 1, from the time since it began. */
function sweep(elapsed: number, period: number): number {
  const turn = (elapsed / period) % 2
  return turn <= 1 ? turn : 2 - turn
}

/** A ball on its way: whose, how it was thrown, and what it takes when it gets there. */
interface Rolling extends Ball {
  /** It has reached the pins. */
  hit: boolean
}

/**
 * Bowling: a lane from above, the pins at the far end. A throw is three stops, each a click or
 * Space: where the ball is set down, how hard, and how much hook; then it rolls and the rules
 * say what falls. Alone the reader bowls every frame; against a girl they take alternate frames,
 * the reader first, and her throws are the rules' own at her skill. What happens is said in the
 * scene's dialogue box; the surface shows the lane and the sheet.
 */
export function Bowling({ play }: { play: GamePlay }): JSX.Element {
  const [balls, setBalls] = useState<Ball[]>([])
  const [rolling, setRolling] = useState<Rolling | null>(null)
  // Which of the three stops is next.
  const [stage, setStage] = useState(0)
  // She is saying something about the last ball: her own next one waits for it.
  const [speaking, setSpeaking] = useState(false)
  const remarks = useRef(0)
  const her = play.opponents[0]
  const frames = play.options.frames ?? 5

  const table = tableOf(balls, frames, Boolean(her))
  const herTurn = table.hers && !table.over
  const waiting = table.over || herTurn || rolling !== null

  // What the sweeps write to, between renders.
  const ballMark = useRef<SVGCircleElement>(null)
  const powerMark = useRef<HTMLSpanElement>(null)
  const hookMark = useRef<HTMLSpanElement>(null)
  // The stop under the hand, and the ones already made for this throw.
  const swept = useRef(0)
  const aim = useRef<Throw>({ position: 0, power: 0.7, hook: 0 })
  const pressedAt = useRef(0)
  // Nothing is set once the table has been taken down.
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // Against her the game is on from the moment she picks up a ball, and the terms are said.
  useEffect(() => {
    if (her) play.narrate(`${her.name} picks out a ball and waves you up first. ${frames} frames each, taking turns.`)
    // Once, as the table opens.
  }, [])

  /** Sends a ball down the lane: what it takes is settled now and shown when it gets there. */
  function bowl(thrown: Throw, hers: boolean): void {
    const path = pathOf(thrown)
    const fallen = path.gutter
      ? []
      : resolvePins(path.arriveX, path.angle, thrown.power, table.standing)
    setRolling({ hers, thrown, before: table.standing, fallen, hit: false })
  }

  /** The reader stops whatever is sweeping; the third stop is the throw. */
  function stop(): void {
    if (waiting) return
    const now = performance.now()
    if (now - pressedAt.current < PRESS_GAP_MS) return
    pressedAt.current = now
    if (balls.length === 0 && stage === 0) play.started()
    if (stage === 0) aim.current.position = swept.current * 2 - 1
    else if (stage === 1) aim.current.power = swept.current
    else {
      bowl({ ...aim.current, hook: swept.current * 2 - 1 }, false)
      return
    }
    setStage(stage + 1)
  }

  /** The ball has stopped and the pins are counted: onto the sheet, into the scene, and on. */
  function land(ball: Ball): void {
    const all = [...balls, ball]
    const told = ballTold(her?.name ?? '', all, all.length - 1, frames)
    setBalls(all)
    setRolling(null)
    setStage(0)
    play.narrate(told.narration)
    if (!tableOf(all, frames, Boolean(her)).over) {
      remark(all, told)
      return
    }

    const mine = totalOf(rollsOf(all, false), frames)
    if (!her) {
      play.finish({ outcome: 'played', summary: soloSummary(all, frames) })
      return
    }
    const hers = totalOf(rollsOf(all, true), frames)
    play.finish({
      outcome: mine > hers ? 'won' : mine < hers ? 'lost' : 'draw',
      summary: versusSummary(her.name, mine, hers),
      account: versusAccount(her.name, all, frames)
    })
  }

  /**
   * Has her say something about the ball just thrown, where it is worth it: a strike, a gutter
   * ball, a split picked up, a turkey, or the last frame coming with the game still open. A few
   * times a game at most, and never on the last ball, which the scene's own reply answers.
   */
  function remark(all: readonly Ball[], told: BallTold): void {
    if (!her || remarks.current >= REMARKS[play.chattiness]) return
    const decider = lastFrameCue(her.name, all, frames)
    // Talkative, she has a word for an ordinary frame too.
    if (!told.notable && !decider && !(play.chattiness === 'lots' && told.closed)) return
    remarks.current++
    setSpeaking(true)
    void play.say(her.charId, decider ? `${told.cue} ${decider}` : told.cue).finally(() => {
      if (live.current) setSpeaking(false)
    })
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (!her) return
    const [mine, hers] = [totalOf(rollsOf(balls, false), frames), totalOf(rollsOf(balls, true), frames)]
    play.situation(
      [
        `The game is ten-pin bowling, ${frames} frames each, taking alternate frames.`,
        `The score is the reader ${mine}, ${her.name} ${hers}.`,
        table.over
          ? 'The last ball has just been bowled.'
          : `It is frame ${table.frame + 1} of ${frames} and ${herTurn ? `${her.name}'s` : "the reader's"} ball, with ${table.standing.length === 10 ? 'all ten pins' : `${table.standing.length} pin${table.standing.length === 1 ? '' : 's'}`} standing.`,
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  }, [balls])

  // Her ball, after a beat: thrown at what is standing, at her skill.
  useEffect(() => {
    if (!her || !herTurn || rolling || speaking) return
    const timer = setTimeout(() => bowl(herThrow(table.standing, her.skill), true), HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Her turn comes round once per ball landed, which the count alone says.
  }, [herTurn, balls.length, rolling === null, speaking])

  // The sweep under the reader's hand: the ball along the foul line, then the two meters.
  useEffect(() => {
    if (waiting) return
    const began = performance.now()
    let frame = 0
    const tick = (now: number): void => {
      const at = sweep(now - began, STAGES[stage].sweepMs)
      swept.current = at
      if (stage === 0) {
        ballMark.current?.setAttribute('cx', String((at * 2 - 1) * START_REACH))
        ballMark.current?.setAttribute('cy', String(START_Y))
      } else {
        const mark = stage === 1 ? powerMark.current : hookMark.current
        if (mark) mark.style.left = `${at * 100}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [waiting, stage])

  // A new throw starts with both meters at rest.
  useEffect(() => {
    if (stage !== 0) return
    if (powerMark.current) powerMark.current.style.left = '0%'
    if (hookMark.current) hookMark.current.style.left = '50%'
  }, [stage, balls.length])

  // The ball on its way: down the lane on its line, through the rack, and then the count.
  const thrown = rolling?.thrown
  useEffect(() => {
    if (!rolling || !thrown) return
    const path = pathOf(thrown)
    // A reader who asked for less motion is shown where the ball went, not the trip.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const runMs = still ? 1 : 1700 - 900 * thrown.power
    const deckMs = still ? 1 : runMs * 0.32
    const began = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = (now: number): void => {
      const along = (now - began) / runMs
      const past = Math.min(1, Math.max(0, (now - began - runMs) / deckMs))
      const gutter = Math.sign(path.arriveX) * (LANE_HALF + 2.6)
      const x =
        along < 1
          ? ballX(thrown, along)
          : path.gutter
            ? gutter
            : Math.max(-LANE_HALF, Math.min(LANE_HALF, path.arriveX + path.angle * DRIFT * past * 3.6))
      const y = along < 1 ? START_Y + (HEAD_Y - START_Y) * along : HEAD_Y - past * (HEAD_Y + 6)
      ballMark.current?.setAttribute('cx', String(x))
      ballMark.current?.setAttribute('cy', String(y))
      if (along >= 1 && !rolling.hit) setRolling((now) => (now && !now.hit ? { ...now, hit: true } : now))
      if (past < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      const { hers, before, fallen } = rolling
      timer = setTimeout(() => land({ hers, thrown, before, fallen }), SETTLE_MS)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
    // One trip per throw; the pins falling partway is this effect's own doing.
  }, [thrown])

  // The ball back in the hand between throws.
  useEffect(() => {
    if (rolling) return
    ballMark.current?.setAttribute('cx', '0')
    ballMark.current?.setAttribute('cy', String(START_Y))
  }, [rolling === null, balls.length])

  // Space stops as a click does, wherever the pointer is, unless the reader is typing to her.
  const stopNow = useRef(stop)
  stopNow.current = stop
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      // A button under focus answers Space itself.
      if (target && (['TEXTAREA', 'INPUT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) return
      event.preventDefault()
      stopNow.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // The rack as it is shown: mid-throw the one thrown at, with what fell lying where it stood.
  const standing = rolling ? rolling.before : table.over ? [] : table.standing
  const down = rolling?.hit ? rolling.fallen : []
  const bowlers = [
    { hers: false, name: 'You' },
    ...(her ? [{ hers: true, name: her.name }] : [])
  ]
  const prompt = table.over
    ? 'Game over'
    : rolling
      ? '…'
      : herTurn
        ? `${her?.name ?? 'She'} is up`
        : STAGES[stage].label

  return (
    <div className="vu-bowling">
      <svg
        className="vu-bowling-lane"
        viewBox={`${-VIEW.half} 0 ${VIEW.half * 2} ${VIEW.height}`}
        role="img"
        aria-label={`The lane, ${standing.length - down.length} pins standing`}
        onClick={stop}
      >
        <rect className="vu-bowling-gutter" x={-VIEW.half} y="0" width={VIEW.half * 2} height={VIEW.height} rx="3" />
        <rect className="vu-bowling-boards" x={-LANE_HALF} y="0" width={LANE_HALF * 2} height={VIEW.height} />
        <line className="vu-bowling-foul" x1={-LANE_HALF} x2={LANE_HALF} y1={START_Y - 6} y2={START_Y - 6} />
        {[-10, -5, 0, 5, 10].map((x) => (
          <path
            key={x}
            className="vu-bowling-arrow"
            d={`M ${x - 1.2} ${96 + Math.abs(x) * 0.6} l 1.2 -4 l 1.2 4 z`}
          />
        ))}
        {PINS.filter((pin) => standing.includes(pin.id)).map((pin) => (
          <circle
            key={pin.id}
            className={`vu-bowling-pin${down.includes(pin.id) ? ' vu-bowling-pin--down' : ''}`}
            cx={pin.x}
            cy={pinY(pin.row)}
            r="2.4"
          />
        ))}
        <circle ref={ballMark} className="vu-bowling-ball" cx="0" cy={START_Y} r="4.25" />
      </svg>

      <div className="vu-bowling-side">
        <table className="vu-bowling-sheet">
          <thead>
            <tr>
              <th />
              {Array.from({ length: frames }, (_, frame) => (
                <th key={frame} scope="col">
                  {frame + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bowlers.map((bowler) => (
              <tr key={bowler.name} data-up={(!table.over && table.hers === bowler.hers) || undefined}>
                <th scope="row">{bowler.name}</th>
                {sheetOf(rollsOf(balls, bowler.hers), frames).map((frame, i) => (
                  <td
                    key={i}
                    data-now={(!table.over && table.hers === bowler.hers && table.frame === i) || undefined}
                  >
                    <span className="vu-bowling-marks">{frame.marks.join(' ') || ' '}</span>
                    <span className="vu-bowling-total">{frame.total ?? ' '}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* The meters keep their place when no throw is being made, so the surface does not jump. */}
        <div className="vu-bowling-meters" data-waiting={waiting || undefined}>
          <div className="vu-bowling-meter" data-live={(!waiting && stage === 1) || undefined}>
            <span className="vu-bowling-meterlabel">power</span>
            <span className="vu-bowling-track">
              <span className="vu-bowling-sweet" />
              <span ref={powerMark} className="vu-bowling-mark" />
            </span>
          </div>
          <div className="vu-bowling-meter" data-live={(!waiting && stage === 2) || undefined}>
            <span className="vu-bowling-meterlabel">hook</span>
            <span className="vu-bowling-track">
              <span className="vu-bowling-centre" />
              <span ref={hookMark} className="vu-bowling-mark" />
            </span>
          </div>
        </div>

        <div className="vu-bowling-throw" inert={waiting || undefined} data-waiting={waiting || undefined}>
          <motion.button
            type="button"
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
            {...gestures(waiting, lift, press)}
            onClick={stop}
          >
            {prompt}
          </motion.button>
          <span className="vu-bowling-hint">click or Space, three times: spot, power, hook</span>
        </div>
      </div>
    </div>
  )
}
