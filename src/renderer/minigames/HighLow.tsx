import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  CALLS_EACH,
  callLine,
  callTold,
  callWins,
  freshDeck,
  herCall,
  rankMark,
  rankWord,
  soloSummary,
  versusAccount,
  versusOver,
  versusSummary,
  type Call,
  type Card,
  type Suit
} from '@shared/highLow'
import { gestures, lift, press } from '../views/motion'
import { BunnyMark } from '../views/screenIcons'
import type { GamePlay } from './play'
import '../vu_styles/HighLow.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** A count of calls as the narration says it. */
const NUMBER: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' }

/** How many times in a game she says something about a call, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 8 } as const

/** How long she takes over a call: long enough for the reader's own to be read first. */
const HER_PAUSE_MS = 1700

/** One call that has been made, and whether it came good. */
interface Made {
  hers: boolean
  call: Call
  right: boolean
}

function CardFace({ card }: { card: Card }): JSX.Element {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span
      className={`vu-highlow-card${red ? ' vu-highlow-card--red' : ''}`}
      aria-label={`${rankMark(card.rank)} of ${card.suit}`}
    >
      <span className="vu-highlow-rank">{rankMark(card.rank)}</span>
      <span className="vu-highlow-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  )
}

/**
 * High-Low: one deck, each call made on the card the last one turned, the cards stacking as they
 * are turned. Alone it is five calls; against a girl the two take turns, the reader first, five
 * calls each, and the better count wins. Her calls are the rules' own, at her skill. What happens
 * is said in the scene's dialogue box; the table shows the cards and the count.
 */
export function HighLow({ play }: { play: GamePlay }): JSX.Element {
  // The deck is cut once; the top card is face up and the rest are turned from the front.
  const [deck] = useState(() => freshDeck())
  const [made, setMade] = useState<Made[]>([])
  // She is saying something about the last call: her own next call waits for it.
  const [speaking, setSpeaking] = useState(false)
  const remarks = useRef(0)
  const her = play.opponents[0]

  // Five calls each unless the two of them settled on fewer.
  const each = play.options.calls ?? CALLS_EACH
  // Sudden death is a game against someone: a call each until one of them is ahead.
  const sudden = Boolean(her) && play.options.sudden === 1
  const isOver = (calls: readonly Made[]): boolean =>
    her ? versusOver(calls, each, sudden) : calls.length >= each
  const shown = deck[made.length]
  const mine = made.filter((turn) => !turn.hers && turn.right).length
  const hers = made.filter((turn) => turn.hers && turn.right).length
  const over = isOver(made)
  const herTurn = Boolean(her) && !over && made.length % 2 === 1

  // Against her the game is on from the moment she sits down, and the deal is said.
  useEffect(() => {
    if (her) play.narrate(`${her.name} cuts the deck and turns the top card: ${rankWord(deck[0].rank)}. ${sudden ? 'Sudden death: a call each until one of you is ahead' : each === 1 ? 'One call each' : `${NUMBER[each] ?? each} calls each`}, yours first.`)
    // Once, as the table opens.
  }, [])

  function call(called: Call, byHer: boolean): void {
    if (over) return
    const next = deck[made.length + 1]
    const all = [...made, { hers: byHer, call: called, right: callWins(shown, next, called) }]
    play.narrate(callLine(byHer && her ? her.name : 'You', called, shown, next))
    setMade(all)
    if (!isOver(all)) {
      remark(all)
      return
    }

    const right = (side: boolean): number =>
      all.filter((turn) => turn.hers === side && turn.right).length
    if (!her) {
      play.finish({ outcome: 'played', summary: soloSummary(right(false), each) })
      return
    }
    const [a, b] = [right(false), right(true)]
    play.finish({
      outcome: a > b ? 'won' : a < b ? 'lost' : 'draw',
      summary: versusSummary(her.name, a, b),
      account: versusAccount(her.name, deck, all, sudden)
    })
  }

  /**
   * Has her say something about the call just made, where it is worth it: a call out of the
   * ordinary, or the lead changing hands. A few times a game at most, and never on the last
   * call, which the scene's own reply answers.
   */
  function remark(all: readonly Made[]): void {
    if (!her || remarks.current >= REMARKS[play.chattiness]) return
    const told = callTold(her.name, deck, all, all.length - 1)
    const lead = (calls: readonly Made[]): number =>
      Math.sign(
        calls.filter((c) => !c.hers && c.right).length - calls.filter((c) => c.hers && c.right).length
      )
    // Judged after a call each, so a lead is one both have had the turns to hold.
    const turned =
      all.length % 2 === 0 && lead(all) !== 0 && lead(all) !== lead(all.slice(0, all.length - 2))
    // Talkative, she has a word for an ordinary call too.
    if (!told.notable && !turned && play.chattiness !== 'lots') return
    remarks.current++
    const cue = turned
      ? `${told.line} That puts ${lead(all) > 0 ? 'the reader' : her.name} ahead.`
      : told.line
    setSpeaking(true)
    void play.say(her.charId, cue).finally(() => setSpeaking(false))
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (!her) return
    play.situation(
      [
        sudden
          ? 'The game is High-Low, sudden death: a call each until one of them is ahead.'
          : `The game is High-Low, ${each} call${each === 1 ? '' : 's'} each.`,
        `The count is the reader ${mine}, ${her.name} ${hers}.`,
        `The card showing is ${rankWord(shown.rank)}.`,
        over ? 'The last card has just been turned.' : herTurn ? `It is ${her.name}'s call.` : "It is the reader's call.",
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // Her call, after a beat: read off every card turned so far, at her skill.
  useEffect(() => {
    if (!her || !herTurn || speaking) return
    const timer = setTimeout(() => {
      call(herCall(shown, deck.slice(0, made.length + 1), her.skill), true)
    }, HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Her turn comes round once per card turned, which the count alone says.
  }, [herTurn, made.length, speaking])

  const played = Math.floor(made.length / (her ? 2 : 1))
  const round = sudden ? played + (over ? 0 : 1) : Math.min(played + 1, each)

  return (
    <div className="vu-highlow">
      <div className="vu-highlow-table">
        {/* The deck face down, the app's own mark on its back. */}
        <span className="vu-highlow-deck" aria-hidden="true">
          <BunnyMark />
        </span>
        {/* Keyed on the count, so each card turned lands on the last as a new one. */}
        <motion.div
          key={made.length}
          className="vu-highlow-shown"
          initial={{ opacity: 0, x: -40, rotate: -6 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <CardFace card={shown} />
        </motion.div>
      </div>

      <p className="vu-highlow-count">
        {her ? `you ${mine} · ${her.name} ${hers}` : `${mine} right`}
        <span className="vu-highlow-round">
          {over ? 'game over' : sudden ? `sudden death · call ${round}` : `call ${round} of ${each}`}
        </span>
      </p>

      {/* The calls keep their place when they cannot be made, so the table does not jump. */}
      <div
        className="vu-highlow-calls"
        inert={over || herTurn || undefined}
        data-waiting={over || herTurn || undefined}
      >
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(over || herTurn, lift, press)}
          onClick={() => call('lower', false)}
        >
          Lower
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(over || herTurn, lift, press)}
          onClick={() => call('higher', false)}
        >
          Higher
        </motion.button>
      </div>
    </div>
  )
}
