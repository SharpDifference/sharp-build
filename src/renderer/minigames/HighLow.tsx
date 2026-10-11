import { useEffect, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  CALLS_EACH,
  callWins,
  freshDeck,
  herCall,
  rankMark,
  soloSummary,
  versusAccount,
  versusSummary,
  type Call,
  type Card,
  type Suit
} from '@shared/highLow'
import { gestures, lift, press } from '../views/motion'
import type { GamePlay } from './play'
import '../vu_styles/HighLow.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** How long she takes over a call, so it reads as hers. */
const HER_PAUSE_MS = 1100

/** One call that has been made: who made it, on which card, and what came. */
interface Turned {
  hers: boolean
  from: Card
  call: Call
  to: Card
  right: boolean
}

function CardFace({ card, small }: { card: Card; small?: boolean }): JSX.Element {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span
      className={`vu-highlow-card${small ? ' vu-highlow-card--small' : ''}${red ? ' vu-highlow-card--red' : ''}`}
      aria-label={`${rankMark(card.rank)} of ${card.suit}`}
    >
      <span className="vu-highlow-rank">{rankMark(card.rank)}</span>
      <span className="vu-highlow-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  )
}

/**
 * High-Low: one deck, each call made on the card the last one turned. Alone it is five calls;
 * against a girl the two take turns, the reader first, five calls each, and the better count
 * wins. Her calls are the rules' own, at her skill.
 */
export function HighLow({ play }: { play: GamePlay }): JSX.Element {
  // The deck is cut once; the top card is face up and the rest are turned from the front.
  const [deck] = useState(() => freshDeck())
  const [turned, setTurned] = useState<Turned[]>([])
  const her = play.opponents[0]

  const total = her ? CALLS_EACH * 2 : CALLS_EACH
  const shown = turned.length > 0 ? turned[turned.length - 1].to : deck[0]
  const mine = turned.filter((turn) => !turn.hers && turn.right).length
  const hers = turned.filter((turn) => turn.hers && turn.right).length
  const over = turned.length >= total
  const herTurn = Boolean(her) && !over && turned.length % 2 === 1
  const last = turned[turned.length - 1]

  function make(made: Call, byHer: boolean): void {
    if (over) return
    const to = deck[turned.length + 1]
    const next = [
      ...turned,
      { hers: byHer, from: shown, call: made, to, right: callWins(shown, to, made) }
    ]
    if (turned.length === 0) play.started()
    setTurned(next)
    if (next.length < total) return
    const right = (side: boolean): number =>
      next.filter((turn) => turn.hers === side && turn.right).length
    if (!her) {
      play.finish({ outcome: 'played', summary: soloSummary(right(false)) })
      return
    }
    const [a, b] = [right(false), right(true)]
    play.finish({
      outcome: a > b ? 'won' : a < b ? 'lost' : 'draw',
      summary: versusSummary(her.name, a, b),
      account: versusAccount(her.name, deck, next)
    })
  }

  // Her call, after a beat: read off every card turned so far, at her skill.
  useEffect(() => {
    if (!her || !herTurn) return
    const timer = setTimeout(() => {
      make(herCall(shown, deck.slice(0, turned.length + 1), her.skill), true)
    }, HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Her turn comes round once per card turned, which the count alone says.
  }, [herTurn, turned.length])

  const round = Math.min(Math.floor(turned.length / (her ? 2 : 1)) + 1, CALLS_EACH)
  const who = (turn: Turned): string => (turn.hers ? (her?.name ?? '') : 'You')

  return (
    <div className="vu-highlow">
      <p className="vu-highlow-count">
        {over ? 'game over' : `call ${round} of ${CALLS_EACH}`} ·{' '}
        {her ? `you ${mine} · ${her.name} ${hers}` : `${mine} right`}
      </p>
      {her?.style && <p className="vu-highlow-style">{`${her.name}: ${her.style}`}</p>}

      <div className="vu-highlow-table">
        <span className="vu-highlow-deck" aria-hidden="true" />
        {/* Keyed on the count, so each card turned arrives as a new one. */}
        <motion.div
          key={turned.length}
          className="vu-highlow-shown"
          initial={{ opacity: 0, x: -40, rotate: -6 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <CardFace card={shown} />
        </motion.div>
      </div>

      <p className="vu-highlow-said" aria-live="polite">
        {!last
          ? 'Is the next card higher or lower?'
          : over
            ? her
              ? mine > hers
                ? `You win, ${mine} to ${hers}.`
                : mine < hers
                  ? `${her.name} wins, ${hers} to ${mine}.`
                  : `Level at ${mine} each.`
              : `${mine} of ${CALLS_EACH} calls right.`
            : `${who(last)} called ${last.call}: ${
                last.right ? 'right' : last.to.rank === last.from.rank ? 'the same again, a miss' : 'a miss'
              }.${herTurn ? ` ${her?.name} is thinking…` : her ? ' Your call.' : ''}`}
      </p>

      {/* The calls keep their place when they cannot be made, so the table does not jump. */}
      <div
        className="vu-highlow-calls"
        inert={over || herTurn || undefined}
        data-over={over || undefined}
        data-waiting={herTurn || undefined}
      >
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(herTurn, lift, press)}
          onClick={() => make('lower', false)}
        >
          Lower
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(herTurn, lift, press)}
          onClick={() => make('higher', false)}
        >
          Higher
        </motion.button>
      </div>

      <ol className="vu-highlow-trail" aria-label="Calls so far">
        {turned.map((turn, i) => (
          <li key={i} className={`vu-highlow-turn${turn.right ? ' vu-highlow-turn--right' : ''}`}>
            {her && <span className="vu-highlow-turnwho">{turn.hers ? her.name : 'you'}</span>}
            <CardFace card={turn.from} small />
            <span className="vu-highlow-turncall">{turn.call}</span>
            <span className="vu-highlow-turnmark">{turn.right ? 'right' : 'miss'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
