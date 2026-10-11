import { useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  CALLS_EACH,
  callWins,
  freshDeck,
  rankMark,
  soloSummary,
  type Call,
  type Card,
  type Suit
} from '@shared/highLow'
import { gestures, lift, press } from '../views/motion'
import type { GamePlay } from './play'
import '../vu_styles/HighLow.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** One call that has been made: the card it was made on, the call, and what came. */
interface Turned {
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

/** High-Low, played alone: five calls on one deck, each on the card the last one turned. */
export function HighLow({ play }: { play: GamePlay }): JSX.Element {
  // The deck is cut once; the top card is face up and the rest are turned from the front.
  const [deck] = useState(() => freshDeck())
  const [turned, setTurned] = useState<Turned[]>([])

  const shown = turned.length > 0 ? turned[turned.length - 1].to : deck[0]
  const right = turned.filter((turn) => turn.right).length
  const over = turned.length >= CALLS_EACH
  const last = turned[turned.length - 1]

  function call(made: Call): void {
    if (over) return
    const to = deck[turned.length + 1]
    const next = [...turned, { from: shown, call: made, to, right: callWins(shown, to, made) }]
    if (turned.length === 0) play.started()
    setTurned(next)
    if (next.length >= CALLS_EACH) {
      play.finish({ outcome: 'played', summary: soloSummary(next.filter((turn) => turn.right).length) })
    }
  }

  return (
    <div className="vu-highlow">
      <p className="vu-highlow-count">
        {over ? 'game over' : `call ${turned.length + 1} of ${CALLS_EACH}`} · {right} right
      </p>

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
            ? `${right} of ${CALLS_EACH} calls right.`
            : last.right
              ? `${last.call === 'higher' ? 'Higher' : 'Lower'} it was.`
              : last.to.rank === last.from.rank
                ? 'The same again: a miss.'
                : `Not ${last.call}.`}
      </p>

      {/* The calls keep their place when the game is over, so the table does not jump. */}
      <div className="vu-highlow-calls" inert={over || undefined} data-over={over || undefined}>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(false, lift, press)}
          onClick={() => call('lower')}
        >
          Lower
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(false, lift, press)}
          onClick={() => call('higher')}
        >
          Higher
        </motion.button>
      </div>

      <ol className="vu-highlow-trail" aria-label="Calls so far">
        {turned.map((turn, i) => (
          <li key={i} className={`vu-highlow-turn${turn.right ? ' vu-highlow-turn--right' : ''}`}>
            <CardFace card={turn.from} small />
            <span className="vu-highlow-turncall">{turn.call}</span>
            <span className="vu-highlow-turnmark">{turn.right ? 'right' : 'miss'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
