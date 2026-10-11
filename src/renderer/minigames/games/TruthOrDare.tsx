import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { listed } from '@shared/minigameKit'
import {
  HEAT_WORD,
  READER,
  accountOf,
  answerHeard,
  answerRound,
  answeredOf,
  askedSoFar,
  askerAt,
  chooseRound,
  chosenOf,
  heatOf,
  judgeRound,
  judgedOf,
  onlooker,
  outcomeOf,
  playerAt,
  poseRound,
  posedOf,
  remarkCue,
  seatName,
  situationOf,
  skippedLine,
  stock,
  summaryOf,
  tally,
  turnsIn,
  type Kind,
  type Terms,
  type Turn
} from '@shared/minigameRules/truthOrDare'
import { gestures, lift, press, quietLift, quietPress } from '../kit'
import type { GamePlay, RoundAsk } from '../kit'
import '../../vu_styles/TruthOrDare.css'

/** The most of what the reader typed that is taken for a question, a dare or an answer. */
const TYPED_MAX = 240

/** How long play waits on a watching girl's remark before going on without it. */
const REMARK_CAP_MS = 2800

/** How long a line of narration takes to write itself on the box and be read, at the box's pace. */

/**
 * Where a turn stands.
 *
 * - `pick`: the reader chooses truth or dare.
 * - `ask`: the reader types the question or the dare for the girl whose turn it is, or taps one.
 * - `answer`: the reader types his answer, or what he does, or backs out.
 *
 * In `ask` and `answer` the scene's own line under the dialogue box is live: it is where he types.
 * - `wait`: a round is out or a line is on its way; nothing of the reader's is live.
 * - `over`: the last turn is played.
 */
type Phase = 'pick' | 'ask' | 'answer' | 'wait' | 'over'

/**
 * The turn being played, as far as the surface shows it: what was picked, and what was put. The
 * rest of a turn is said on the dialogue box and nowhere else.
 */
interface Now {
  kind: Kind | null
  prompt: string
}

const BLANK: Now = { kind: null, prompt: '' }

/**
 * Truth or Dare: turns go round the table, the reader first. Whoever's turn it is picks truth or
 * dare and the player before them puts it. The girls' picks, questions, answers and verdicts are
 * the model's, a round at a time; the reader types his own into the scene's line under the dialogue
 * box. Everything said is said there, once; the surface is the scorecard: the tally, whose turn
 * it is, what is wanted now, and the buttons that apply.
 */
export function TruthOrDare({ play }: { play: GamePlay }): JSX.Element {
  // The table as it was when the game opened: who sits where does not change under a game.
  const [terms] = useState<Terms>(() => ({
    names: play.opponents.map((girl) => girl.name),
    rounds: play.options.rounds ?? 2,
    heat: heatOf(play.options.heat)
  }))
  const [girls] = useState(() => play.opponents.map((girl) => girl.charId))
  const [log, setLog] = useState<Turn[]>([])
  const [phase, setPhase] = useState<Phase>('wait')
  const [now, setNow] = useState<Now>(BLANK)
  /** What the reader is waiting on, in words; empty where a line is simply being read. */
  const [waiting, setWaiting] = useState('')

  // The framework's handle is read through a ref: a turn's chain of rounds outlives a render.
  const latest = useRef(play)
  latest.current = play
  /** Mounted, and not finished: nothing is said or set otherwise. */
  const live = useRef(false)
  const opened = useRef(false)
  const finished = useRef(false)
  /** The turns played, as the chain of rounds knows them: state lags a render behind. */
  const played = useRef<Turn[]>([])
  const turnNow = useRef<Now>(BLANK)
  /** Where the turn stands, for a press that lands twice before a render. */
  const at = useRef<Phase>('wait')
  const remarks = useRef(0)

  /** A remark from a girl watching is still being written: no second one is asked for. */
  const saying = useRef(false)
  /** Every pause still running, by its timer, with what ends it early. */
  const pauses = useRef(new Map<ReturnType<typeof setTimeout>, () => void>())

  const charOf = (seat: number): string => girls[seat - 1]
  const on = (): boolean => live.current && !finished.current

  function show(next: Now): void {
    turnNow.current = next
    setNow(next)
  }

  function stand(next: Phase): void {
    at.current = next
    setPhase(next)
  }

  function tell(what: string): void {
    latest.current.situation(situationOf(terms, played.current, what))
  }

  /** A beat, on a timer the table takes with it when it closes. */
  function pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pauses.current.delete(timer)
        resolve()
      }, ms)
      pauses.current.set(timer, resolve)
    })
  }

  /** A line of narration, waited out: on the box behind everything before it, and then read. */
  async function narrated(text: string): Promise<void> {
    await latest.current.narrate(text).catch(() => undefined)
  }

  /** A girl's line in words already written, waited out. Never rejects. */
  async function speak(seat: number, line: string): Promise<void> {
    await latest.current.speak(charOf(seat), line).catch(() => undefined)
  }

  /** A round, with what the reader is told while it is out. Null where it failed. */
  async function round(plan: RoundAsk, wait: string): Promise<Record<string, string> | null> {
    stand('wait')
    setWaiting(wait)
    const got = await latest.current.round(plan).catch(() => null)
    if (on()) setWaiting('')
    return got
  }

  /** Opens the turn after the last one played, or ends the game. */
  async function open(): Promise<void> {
    if (!on()) return
    const done = played.current
    const turn = done.length
    // What has been asked and answered so far is the scene's to keep even if he walks away.
    if (turn > 0) latest.current.progress(accountOf(terms, done))
    if (turn >= turnsIn(terms)) {
      tell('')
      finished.current = true
      stand('over')
      latest.current.finish({
        outcome: outcomeOf(tally(terms, done)),
        summary: summaryOf(terms, done),
        account: accountOf(terms, done)
      })
      return
    }
    show(BLANK)
    const player = playerAt(terms, turn)
    if (player === READER) {
      tell('The reader is picking truth or dare.')
      stand('pick')
      return
    }
    const name = seatName(terms, player)
    tell(`${name} is picking truth or dare.`)
    const got = await round(chooseRound(terms, done), `${name} is deciding…`)
    if (!on()) return
    const chosen = chosenOf(got)
    const putting = chosen.kind === 'truth' ? 'asking the question' : 'setting the dare'
    show({ ...BLANK, kind: chosen.kind })
    await speak(player, chosen.line)
    if (!on()) return
    // With one girl he asks; round a fuller table the girl before her does.
    const asker = askerAt(terms, turn)
    if (asker === READER) {
      tell(`${name} picked ${chosen.kind}; the reader is ${putting}.`)
      stand('ask')
      void typing('ask', chosen.kind === 'truth' ? `Ask ${name} a question…` : `Dare ${name} to…`)
      return
    }
    const askerName = seatName(terms, asker)
    tell(`${name} picked ${chosen.kind}; ${askerName} is ${putting}.`)
    const posed = await round(poseRound(terms, done, chosen.kind), `${askerName} is thinking…`)
    if (!on()) return
    const prompt = posedOf(posed, chosen.kind, terms.heat, done)
    show({ ...turnNow.current, prompt })
    await speak(asker, prompt)
    await herAnswer(chosen.kind, prompt)
  }

  /** The girl whose turn it is answers what was put to her, and the turn is closed. */
  async function herAnswer(kind: Kind, prompt: string): Promise<void> {
    if (!on()) return
    const done = played.current
    const player = playerAt(terms, done.length)
    const name = seatName(terms, player)
    const plan = answerRound(terms, done, kind, prompt)
    tell(`${name} picked ${kind} and was ${kind === 'truth' ? 'asked' : 'dared'}: "${prompt}"`)
    let got = await round(plan, `${name} is thinking…`)
    if (!on()) return
    // A truth nobody can answer for her: a round that failed is asked for once more.
    if (kind === 'truth' && !answerHeard(got, kind)) {
      got = await round(plan, `${name} is still thinking…`)
      if (!on()) return
    }
    const answered = answeredOf(got, kind, name)
    if (answered.verdict === 'skipped') {
      await narrated(skippedLine(name))
    } else {
      // What she says, and then what she is seen to do, each given its time.
      await speak(player, answered.line)
      if (!on()) return
      if (answered.deed) await narrated(answered.deed)
    }
    await close({
      player,
      asker: askerAt(terms, done.length),
      kind,
      prompt,
      reply: answered.line,
      deed: answered.deed,
      verdict: answered.verdict
    })
  }

  /** The turn is played: it is counted, somebody watching may say a word, and the next opens. */
  async function close(turn: Turn): Promise<void> {
    if (!on()) return
    played.current = [...played.current, turn]
    setLog(played.current)
    tell('')
    // One remark out at a time; one passed over for that is not counted against the table.
    const watcher = saying.current
      ? null
      : onlooker(terms, played.current, latest.current.chattiness, remarks.current)
    if (watcher !== null) {
      remarks.current++
      saying.current = true
      const said = Promise.resolve()
        .then(() => latest.current.say(charOf(watcher), remarkCue(terms, turn)))
        .catch(() => undefined)
        .then(() => {
          saying.current = false
        })
      // Her line is the model's and may be slow: play goes on, and it lands when it comes.
      await Promise.race([said, pause(REMARK_CAP_MS)])
    }
    await open()
  }

  /** The reader picks truth or dare; the girl before him puts it. */
  async function pick(kind: Kind): Promise<void> {
    if (at.current !== 'pick' || !on()) return
    // Taken at once, so a second press finds nothing to pick.
    stand('wait')
    const done = played.current
    const asker = askerAt(terms, done.length)
    const askerName = seatName(terms, asker)
    show({ ...BLANK, kind })
    latest.current.readerSays(kind === 'truth' ? 'Truth.' : 'Dare.')
    tell(
      `The reader picked ${kind}; ${askerName} is ${kind === 'truth' ? 'asking the question' : 'setting the dare'}.`
    )
    const got = await round(poseRound(terms, done, kind), `${askerName} is thinking…`)
    if (!on()) return
    const prompt = posedOf(got, kind, terms.heat, done)
    show({ ...turnNow.current, prompt })
    await speak(asker, prompt)
    if (!on()) return
    tell(`The reader picked ${kind} and was ${kind === 'truth' ? 'asked' : 'dared'}: "${prompt}"`)
    stand('answer')
    void typing('answer', kind === 'truth' ? 'Your answer…' : 'What you do…')
  }

  /**
   * Has the reader type what the turn wants of him, in the scene's own line, and plays it. Nothing
   * comes of it where the asking ended first: the table closed, or he tapped a button instead,
   * which has already moved the turn on.
   */
  async function typing(want: 'ask' | 'answer', placeholder: string): Promise<void> {
    const turn = played.current.length
    const sent = await latest.current.ask(placeholder).catch(() => null)
    if (sent === null || !on() || at.current !== want || played.current.length !== turn) return
    const words = sent.trim().slice(0, TYPED_MAX)
    if (want === 'ask') void put(words)
    else void answer(words)
  }

  /** A suggestion tapped: sent as if typed, and the line under the box is let go. */
  function suggest(idea: string): void {
    if (at.current !== 'ask' || !on()) return
    latest.current.stopAsking()
    void put(idea)
  }

  /** The reader backs out of what was put to him, and the line under the box is let go. */
  function backOut(): void {
    if (at.current !== 'answer' || !on()) return
    latest.current.stopAsking()
    void answer(null)
  }

  /** The reader's answer, or what he does; null where he backs out. She reacts and judges. */
  async function answer(reply: string | null): Promise<void> {
    const { kind, prompt } = turnNow.current
    if (at.current !== 'answer' || !on() || !kind || reply === '') return
    stand('wait')
    const done = played.current
    const asker = askerAt(terms, done.length)
    if (reply === null) {
      // Not waited on: her line queues behind it on the box.
      void latest.current
        .narrate(kind === 'truth' ? 'You pass on the question.' : 'You back out of the dare.')
        .catch(() => undefined)
      tell(`The reader backed out of the ${kind}: "${prompt}"`)
    } else {
      latest.current.readerSays(reply)
      tell(
        `The reader was ${kind === 'truth' ? 'asked' : 'dared'}: "${prompt}" and ${kind === 'truth' ? 'answered' : 'says he does this'}: "${reply}"`
      )
    }
    const got = await round(
      judgeRound(terms, done, kind, prompt, reply),
      `${seatName(terms, asker)} is thinking…`
    )
    if (!on()) return
    const judged = judgedOf(got, kind, reply)
    await speak(asker, judged.line)
    await close({
      player: READER,
      asker,
      kind,
      prompt,
      reply: reply ?? '',
      deed: '',
      verdict: judged.verdict
    })
  }

  /** The reader's question or dare for the girl whose turn it is. */
  async function put(words: string): Promise<void> {
    const prompt = words.trim()
    const { kind } = turnNow.current
    if (at.current !== 'ask' || !on() || !kind || !prompt) return
    stand('wait')
    show({ ...turnNow.current, prompt })
    latest.current.readerSays(prompt)
    await herAnswer(kind, prompt)
  }

  // The table opens on the game under way: it is said once, read, and then the reader's turn is
  // first. Nothing is asked of him while the line is still arriving.
  useEffect(() => {
    live.current = true
    if (!opened.current) {
      opened.current = true
      const each = terms.rounds === 1 ? 'one turn each' : `${terms.rounds} turns each`
      void narrated(
        `Truth or Dare with ${listed(terms.names)}: ${each}, kept ${HEAT_WORD[terms.heat]}. You go first.`
      ).then(open)
    }
    const running = pauses.current
    return () => {
      live.current = false
      // A question still open is taken back: nobody is left to hear the answer.
      if (at.current === 'ask' || at.current === 'answer') latest.current.stopAsking()
      // Every pause is ended: whatever waited on one finds the table gone and stops.
      for (const [timer, end] of running) {
        clearTimeout(timer)
        end()
      }
      running.clear()
    }
    // Once, as the table opens.
  }, [])

  const turn = log.length
  const over = phase === 'over'
  const player = over ? -1 : playerAt(terms, turn)
  const asker = over ? -1 : askerAt(terms, turn)
  const score = tally(terms, log)
  const kind = now.kind
  const ideas = phase === 'ask' && kind ? stock(kind, terms.heat, askedSoFar(log), 3, turn) : []
  /** What is happening and what is wanted now, in one line. */
  const state = over
    ? 'That is the game.'
    : phase === 'pick'
      ? 'Your turn: truth or dare?'
      : phase === 'ask'
        ? `Your turn to ${kind === 'dare' ? 'dare' : 'ask'} ${seatName(terms, player)}: type it below, or pick one`
        : phase === 'answer'
          ? kind === 'dare'
            ? `${seatName(terms, asker)} dared you: say what you do below`
            : `${seatName(terms, asker)} asked you a truth: answer below`
          : waiting || '…'
  // What was put to the reader stays in sight until his turn is over: the box moves on.
  const kept = !over && player === READER ? now.prompt : ''

  return (
    <div className="vu-tod">
      <ul
        className="vu-tod-tally"
        aria-label={`Tally, turn ${Math.min(turn + 1, turnsIn(terms))} of ${turnsIn(terms)}`}
      >
        {score.map((points, seat) => (
          <li key={seat} className="vu-tod-seat" data-turn={seat === player || undefined}>
            <span className="vu-tod-seatname">{seatName(terms, seat)}</span>
            <span className="vu-tod-points">{points}</span>
          </li>
        ))}
      </ul>

      <p
        className="vu-tod-state"
        role="status"
        data-out={phase !== 'wait' || waiting !== '' || undefined}
      >
        {state}
      </p>

      {kept && (
        <p className="vu-tod-kept" title={kept}>
          <span className="vu-tod-kind">{kind}</span>
          {kept}
        </p>
      )}

      {phase === 'pick' && (
        <div className="vu-tod-picks">
          <motion.button
            type="button"
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
            {...gestures(false, lift, press)}
            onClick={() => void pick('truth')}
          >
            Truth
          </motion.button>
          <motion.button
            type="button"
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
            {...gestures(false, lift, press)}
            onClick={() => void pick('dare')}
          >
            Dare
          </motion.button>
        </div>
      )}

      {ideas.length > 0 && (
        <ul className="vu-tod-ideas" aria-label="Suggestions">
          {ideas.map((idea) => (
            <li key={idea}>
              <motion.button
                type="button"
                className="vu-tod-idea"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => suggest(idea)}
              >
                {idea}
              </motion.button>
            </li>
          ))}
        </ul>
      )}

      {phase === 'answer' && (
        <div className="vu-tod-picks">
          <motion.button
            type="button"
            className="vu-btn vu-btn--quiet"
            {...gestures(false, quietLift, quietPress)}
            onClick={backOut}
          >
            Back out
          </motion.button>
        </div>
      )}
    </div>
  )
}
