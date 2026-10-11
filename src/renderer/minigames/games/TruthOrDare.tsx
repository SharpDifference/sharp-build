import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { listed } from '@shared/minigameKit'
import {
  HEAT_WORD,
  READER,
  accountOf,
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
  scored,
  seatName,
  situationOf,
  stock,
  summaryOf,
  tally,
  turnsIn,
  type Kind,
  type Terms,
  type Turn,
  type Verdict
} from '@shared/minigameRules/truthOrDare'
import { TextField } from '../kit'
import { gestures, lift, press, quietLift, quietPress } from '../kit'
import type { GamePlay, RoundAsk } from '../kit'
import '../../vu_styles/TruthOrDare.css'

/** The most the reader may type for a question, a dare or an answer. */
const TYPED_MAX = 240

/**
 * Where a turn stands.
 *
 * - `pick`: the reader chooses truth or dare.
 * - `ask`: the reader types the question or the dare for the girl whose turn it is.
 * - `answer`: the reader types his answer, or what he does, or backs out.
 * - `wait`: a round is out or a line is on its way; nothing of the reader's is live.
 * - `over`: the last turn is played.
 */
type Phase = 'pick' | 'ask' | 'answer' | 'wait' | 'over'

/** The turn being played, as far as it has got: what the surface shows of it. */
interface Now {
  kind: Kind | null
  prompt: string
  reply: string
  deed: string
  verdict: Verdict | null
}

const BLANK: Now = { kind: null, prompt: '', reply: '', deed: '', verdict: null }

const VERDICT_MARK: Record<Verdict, string> = {
  honest: 'answered straight · a point',
  dodged: 'dodged · no point',
  done: 'done · a point',
  chickened: 'backed out · no point'
}

/**
 * Truth or Dare: turns go round the table, the reader first. Whoever's turn it is picks truth or
 * dare and the player before them puts it. The girls' picks, questions, answers and verdicts are
 * the model's, a round at a time; the reader types his own into the game's field. The surface
 * shows the tally, whose turn it is and the turn so far.
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
  const [typed, setTyped] = useState('')

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

  /** A round, with what the reader is told while it is out. Null where it failed. */
  async function round(plan: RoundAsk, wait: string): Promise<Record<string, string> | null> {
    stand('wait')
    setWaiting(wait)
    const got = await latest.current.round(plan)
    if (on()) setWaiting('')
    return got
  }

  /** Opens the turn after the last one played, or ends the game. */
  async function open(): Promise<void> {
    if (!on()) return
    const done = played.current
    const turn = done.length
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
    setTyped('')
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
    await latest.current.speak(charOf(player), chosen.line)
    if (!on()) return
    // With one girl he asks; round a fuller table the girl before her does.
    const asker = askerAt(terms, turn)
    if (asker === READER) {
      tell(`${name} picked ${chosen.kind}; the reader is ${putting}.`)
      stand('ask')
      return
    }
    const askerName = seatName(terms, asker)
    tell(`${name} picked ${chosen.kind}; ${askerName} is ${putting}.`)
    const posed = await round(poseRound(terms, done, chosen.kind), `${askerName} is thinking…`)
    if (!on()) return
    const prompt = posedOf(posed, chosen.kind, terms.heat, done)
    show({ ...turnNow.current, prompt })
    await latest.current.speak(charOf(asker), prompt)
    await herAnswer(chosen.kind, prompt)
  }

  /** The girl whose turn it is answers what was put to her, and the turn is closed. */
  async function herAnswer(kind: Kind, prompt: string): Promise<void> {
    if (!on()) return
    const done = played.current
    const player = playerAt(terms, done.length)
    const name = seatName(terms, player)
    tell(`${name} picked ${kind} and was ${kind === 'truth' ? 'asked' : 'dared'}: "${prompt}"`)
    const got = await round(answerRound(terms, done, kind, prompt), `${name} is thinking…`)
    if (!on()) return
    const answered = answeredOf(got, kind, name)
    show({ kind, prompt, reply: answered.line, deed: answered.deed, verdict: answered.verdict })
    // What she does is narrated ahead of what she says, and her line is waited out behind it.
    if (answered.deed) latest.current.narrate(answered.deed)
    await latest.current.speak(charOf(player), answered.line)
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
    const watcher = onlooker(terms, played.current, latest.current.chattiness, remarks.current)
    if (watcher !== null) {
      remarks.current++
      await latest.current.say(charOf(watcher), remarkCue(terms, turn))
    }
    await open()
  }

  /** The reader picks truth or dare; the girl before him puts it. */
  async function pick(kind: Kind): Promise<void> {
    if (at.current !== 'pick' || !on()) return
    const done = played.current
    const asker = askerAt(terms, done.length)
    const askerName = seatName(terms, asker)
    show({ ...BLANK, kind })
    latest.current.readerSays(kind === 'truth' ? 'Truth.' : 'Dare.')
    tell(`The reader picked ${kind}; ${askerName} is ${kind === 'truth' ? 'asking the question' : 'setting the dare'}.`)
    const got = await round(poseRound(terms, done, kind), `${askerName} is thinking…`)
    if (!on()) return
    const prompt = posedOf(got, kind, terms.heat, done)
    show({ ...turnNow.current, prompt })
    await latest.current.speak(charOf(asker), prompt)
    if (!on()) return
    tell(`The reader picked ${kind} and was ${kind === 'truth' ? 'asked' : 'dared'}: "${prompt}"`)
    stand('answer')
  }

  /** The reader's answer, or what he does; null where he backs out. She reacts and judges. */
  async function answer(reply: string | null): Promise<void> {
    const { kind, prompt } = turnNow.current
    if (at.current !== 'answer' || !on() || !kind || reply === '') return
    const done = played.current
    const asker = askerAt(terms, done.length)
    setTyped('')
    show({ ...turnNow.current, reply: reply ?? '' })
    if (reply === null) {
      latest.current.narrate(kind === 'truth' ? 'You pass on the question.' : 'You back out of the dare.')
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
    show({ ...turnNow.current, verdict: judged.verdict })
    await latest.current.speak(charOf(asker), judged.line)
    await close({ player: READER, asker, kind, prompt, reply: reply ?? '', deed: '', verdict: judged.verdict })
  }

  /** The reader's question or dare for the girl whose turn it is. */
  async function put(words: string): Promise<void> {
    const prompt = words.trim()
    const { kind } = turnNow.current
    if (at.current !== 'ask' || !on() || !kind || !prompt) return
    setTyped('')
    stand('wait')
    show({ ...turnNow.current, prompt })
    latest.current.readerSays(prompt)
    await herAnswer(kind, prompt)
  }

  // The table opens on the game under way: it is said once, and the reader's turn is first.
  useEffect(() => {
    live.current = true
    if (!opened.current) {
      opened.current = true
      const each = terms.rounds === 1 ? 'one turn each' : `${terms.rounds} turns each`
      play.narrate(
        `Truth or Dare with ${listed(terms.names)}: ${each}, kept ${HEAT_WORD[terms.heat]}. You go first.`
      )
      void open()
    }
    return () => {
      live.current = false
    }
    // Once, as the table opens.
  }, [])

  const turn = log.length
  const over = phase === 'over'
  const player = over ? -1 : playerAt(terms, turn)
  const asker = over ? -1 : askerAt(terms, turn)
  const score = tally(terms, log)
  const kind = now.kind
  const field = phase === 'ask' || phase === 'answer'
  const ideas = phase === 'ask' && kind ? stock(kind, terms.heat, askedSoFar(log), 3, turn) : []
  const send = (): void => {
    if (phase === 'ask') void put(typed)
    else if (phase === 'answer' && typed.trim()) void answer(typed.trim())
  }
  const whose = (seat: number): string => (seat === READER ? 'Your' : `${seatName(terms, seat)}'s`)
  const asks = (seat: number): string => (seat === READER ? 'you ask' : `${seatName(terms, seat)} asks`)
  /** Who said the answer on show. */
  const replier = player >= 0 ? seatName(terms, player) : ''

  return (
    <div className="vu-tod">
      <ul className="vu-tod-tally" aria-label="Tally">
        {score.map((points, seat) => (
          <li key={seat} className="vu-tod-seat" data-turn={seat === player || undefined}>
            <span className="vu-tod-seatname">{seatName(terms, seat)}</span>
            <span className="vu-tod-points">{points}</span>
          </li>
        ))}
      </ul>

      <p className="vu-tod-turn" aria-live="polite">
        {over ? (
          'game over'
        ) : (
          <>
            {whose(player)} turn
            <span className="vu-tod-turnmeta">
              {asks(asker)} · turn {turn + 1} of {turnsIn(terms)} · {HEAT_WORD[terms.heat]}
            </span>
          </>
        )}
      </p>

      {/* The turn so far: what was put and what came of it, so the box need not be relied on. */}
      <div className="vu-tod-log">
        <p className="vu-tod-kind">{kind ?? (over ? 'that is the game' : 'truth or dare?')}</p>
        {now.prompt && (
          <p className="vu-tod-line">
            <span className="vu-tod-who">{asker >= 0 ? seatName(terms, asker) : ''}</span>
            {now.prompt}
          </p>
        )}
        {(now.reply || now.deed) && (
          <p className="vu-tod-line">
            <span className="vu-tod-who">{replier}</span>
            {now.reply}
            {now.deed && <span className="vu-tod-deed">{now.deed}</span>}
          </p>
        )}
        {now.verdict && (
          <p className="vu-tod-verdict" data-scored={scored(now.verdict) || undefined}>
            {VERDICT_MARK[now.verdict]}
          </p>
        )}
      </div>

      {/* One of three things stands here, in the same room: the pick, the field, or the wait. */}
      <div className="vu-tod-act">
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

        {field && kind && (
          <form
            className="vu-tod-form"
            onSubmit={(event) => {
              event.preventDefault()
              send()
            }}
            // Enter sends from the game's own field, and nothing behind the table answers it too.
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.stopPropagation()
              if ((event.target as HTMLElement).tagName !== 'INPUT') return
              event.preventDefault()
              send()
            }}
          >
            <TextField
              // A new field each time one is called for, so it takes the focus as it arrives.
              key={`${turn}:${phase}`}
              id="truth-or-dare-text"
              label={
                phase === 'ask'
                  ? `Your ${kind === 'truth' ? 'question' : 'dare'} for ${seatName(terms, player)}`
                  : kind === 'truth'
                    ? 'Your answer'
                    : 'What you do'
              }
              value={typed}
              onChange={setTyped}
              maxLength={TYPED_MAX}
              placeholder={
                phase === 'ask'
                  ? kind === 'truth'
                    ? 'Ask her anything…'
                    : 'Dare her to…'
                  : kind === 'truth'
                    ? 'Answer in your own words…'
                    : 'Say what you do…'
              }
              autoFocus
            />
            {ideas.length > 0 && (
              <ul className="vu-tod-ideas" aria-label="Suggestions">
                {ideas.map((idea) => (
                  <li key={idea}>
                    <motion.button
                      type="button"
                      className="vu-tod-idea"
                      {...gestures(false, quietLift, quietPress)}
                      onClick={() => void put(idea)}
                    >
                      {idea}
                    </motion.button>
                  </li>
                ))}
              </ul>
            )}
            <div className="vu-tod-send">
              {phase === 'answer' && (
                <motion.button
                  type="button"
                  className="vu-btn vu-btn--quiet"
                  {...gestures(false, quietLift, quietPress)}
                  onClick={() => void answer(null)}
                >
                  Back out
                </motion.button>
              )}
              <motion.button
                type="submit"
                className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
                disabled={!typed.trim()}
                {...gestures(!typed.trim(), lift, press)}
              >
                {phase === 'ask' ? (kind === 'truth' ? 'Ask' : 'Dare') : kind === 'truth' ? 'Answer' : 'Do it'}
              </motion.button>
            </div>
          </form>
        )}

        {(phase === 'wait' || over) && (
          <p className="vu-tod-wait" role="status" data-out={waiting !== '' || undefined}>
            {over ? 'The last turn is played.' : waiting || '…'}
          </p>
        )}
      </div>
    </div>
  )
}
