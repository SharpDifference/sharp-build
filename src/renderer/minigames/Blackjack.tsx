import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  HANDS,
  RESHUFFLE_UNDER,
  dealLine,
  drawCard,
  handTold,
  handTotal,
  handsWon,
  herMove,
  isNatural,
  matchAccount,
  matchOver,
  matchSummary,
  resultLine,
  soundMove,
  totalWord,
  type HandPlayed,
  type HerMoveMade,
  type HitMade
} from '@shared/blackjack'
import { freshDeck, rankMark, rankWord, type Card, type Suit } from '@shared/highLow'
import { gestures, lift, press } from '../views/motion'
import { BunnyMark } from '../views/screenIcons'
import type { GamePlay } from './play'
import '../vu_styles/Blackjack.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** How many times in a match she says something about a hand, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 2, lots: 5 } as const

/** How long she takes over a move: long enough for the last one to be read first. */
const HER_PAUSE_MS = 1700

/** How long a finished hand lies on the table before the next is dealt. */
const NEXT_HAND_MS = 2400

/** The hand on the table: whose move it is, and how each got to what they hold. */
interface Table {
  deck: Card[]
  mine: Card[]
  hers: Card[]
  hits: HitMade[]
  herMoves: HerMoveMade[]
  /** Whose move it is, or `over` once the hand is settled. */
  phase: 'mine' | 'hers' | 'over'
  /** Her face-down card has been turned. */
  turned: boolean
  /** The hands already finished, this one among them once it is over. */
  done: HandPlayed[]
}

/** A new hand off the deck: a card each, twice, hers second. A two-card 21 of his plays itself. */
function deal(from: readonly Card[], done: HandPlayed[]): Table {
  const deck = from.length < RESHUFFLE_UNDER ? freshDeck() : [...from]
  const mine = [deck[0], deck[2]]
  return {
    deck: deck.slice(4),
    mine,
    hers: [deck[1], deck[3]],
    hits: [],
    herMoves: [],
    phase: isNatural(mine) ? 'hers' : 'mine',
    turned: false,
    done
  }
}

function CardFace({ card }: { card: Card }): JSX.Element {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span
      className={`vu-blackjack-card${red ? ' vu-blackjack-card--red' : ''}`}
      aria-label={`${rankMark(card.rank)} of ${card.suit}`}
    >
      <span className="vu-blackjack-rank">{rankMark(card.rank)}</span>
      <span className="vu-blackjack-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  )
}

/** One side's cards in a row, each landing as it is dealt; `hidden` is her card still face down. */
function Hand({ cards, hidden }: { cards: readonly Card[]; hidden?: boolean }): JSX.Element {
  return (
    <div className="vu-blackjack-hand" data-many={cards.length > 4 || undefined}>
      {cards.map((card, i) => (
        <motion.span
          // Keyed on which side is up as well, so the turned card lands as a new one.
          key={`${i}:${hidden && i === 1 ? 'back' : 'face'}`}
          className="vu-blackjack-seat"
          initial={{ opacity: 0, y: -18, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          {hidden && i === 1 ? (
            <span className="vu-blackjack-back" aria-label="a card face down">
              <BunnyMark />
            </span>
          ) : (
            <CardFace card={card} />
          )}
        </motion.span>
      ))}
    </div>
  )
}

/**
 * Blackjack, heads-up with no dealer: a few hands, each a card or two towards 21. The reader
 * hits or stands first; she then turns her face-down card and plays knowing what she has to
 * beat, at her skill. Most hands won takes the match. What happens is said in the scene's
 * dialogue box; the table shows the two hands and the count.
 */
export function Blackjack({ play }: { play: GamePlay }): JSX.Element | null {
  const her = play.opponents[0]
  // Three hands unless the two of them settled on another number.
  const hands = play.options.hands ?? HANDS
  const [table, setTable] = useState<Table>(() => deal(freshDeck(), []))
  // She is saying something about the last hand: the next one waits for it.
  const [speaking, setSpeaking] = useState(false)
  const remarks = useRef(0)
  // The framework may clear the table at any moment; nothing is set on one that is gone.
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const name = her?.name ?? 'her'
  const score = handsWon(table.done)
  const over = matchOver(score.mine, score.hers, table.done.length, hands)
  const handNo = table.done.length + (table.phase === 'over' ? 0 : 1)
  const myTurn = table.phase === 'mine'

  // The game is on from the moment she sits down, and the first deal is said.
  useEffect(() => {
    if (!her) return
    play.narrate(
      `${name} shuffles and deals. ${hands === 1 ? 'One hand decides it' : `Best of ${hands} hands`}, your move first each time.`
    )
    play.narrate(dealLine(name, 1, table.mine, table.hers[0]))
    // Once, as the table opens.
  }, [])

  /** The hand is settled: its result is said, and the match either ends or goes on. */
  function settle(now: Table): void {
    const hand: HandPlayed = {
      mine: now.mine,
      hers: now.hers,
      hits: now.hits,
      herMoves: now.herMoves
    }
    const done = [...table.done, hand]
    const won = handsWon(done)
    play.narrate(`${resultLine(name, hand.mine, hand.hers)} You ${won.mine}, ${name} ${won.hers}.`)
    setTable({ ...now, phase: 'over', turned: true, done })
    if (!matchOver(won.mine, won.hers, done.length, hands)) {
      remark(done)
      return
    }
    play.finish({
      outcome: won.mine > won.hers ? 'won' : won.mine < won.hers ? 'lost' : 'draw',
      summary: matchSummary(name, won.mine, won.hers),
      account: matchAccount(name, done, hands)
    })
  }

  /**
   * Has her say something about the hand just finished, where it is worth it: a bust, a
   * two-card 21, a hand taken by a point, or the next hand being the one that decides it. A
   * few times a match at most, and never on the last hand, which the scene's own reply answers.
   */
  function remark(done: readonly HandPlayed[]): void {
    if (!her || remarks.current >= REMARKS[play.chattiness]) return
    const told = handTold(name, done[done.length - 1], done.length)
    const won = handsWon(done)
    const deciding = done.length + 1 === hands && Math.abs(won.mine - won.hers) <= 1
    // Talkative, she has a word for an ordinary hand too.
    if (!told.notable && !deciding && play.chattiness !== 'lots') return
    remarks.current++
    const cue = `${told.line} That makes it the reader ${won.mine}, ${name} ${won.hers}.${deciding ? ' The next hand is the last and decides it.' : ''}`
    setSpeaking(true)
    void play.say(her.charId, cue).finally(() => {
      if (live.current) setSpeaking(false)
    })
  }

  function hit(): void {
    if (!myTurn) return
    const before = handTotal(table.mine)
    const [card, deck] = drawCard(table.deck)
    const mine = [...table.mine, card]
    const { total } = handTotal(mine)
    const now: Table = { ...table, deck, mine, hits: [...table.hits, before] }
    if (total > 21) {
      play.narrate(`You hit on ${before.total}: ${rankWord(card.rank)}. ${total}, bust.`)
      settle(now)
      return
    }
    play.narrate(
      `You hit on ${before.total}: ${rankWord(card.rank)}. ${total}${total === 21 ? ', and you stand' : ''}.`
    )
    // Nothing is left to draw for on 21: it is her move.
    setTable({ ...now, phase: total === 21 ? 'hers' : 'mine' })
  }

  function stand(): void {
    if (!myTurn) return
    play.narrate(`You stand on ${handTotal(table.mine).total}.`)
    setTable({ ...table, phase: 'hers' })
  }

  /** Her next step: the face-down card first, then a move at a time until she stands or busts. */
  function herStep(): void {
    if (!her) return
    if (!table.turned) {
      play.narrate(
        `${name} turns her card: ${rankWord(table.hers[1].rank)}. She has ${totalWord(table.hers)}.`
      )
      setTable({ ...table, turned: true })
      return
    }
    const before = handTotal(table.hers).total
    const move = herMove(table.hers, table.mine, her.skill)
    const made: HerMoveMade = { move, total: before, sound: soundMove(table.hers, table.mine) }
    const herMoves = [...table.herMoves, made]
    if (move === 'stand') {
      play.narrate(`${name} stands on ${before}.`)
      settle({ ...table, herMoves })
      return
    }
    const [card, deck] = drawCard(table.deck)
    const hers = [...table.hers, card]
    const { total } = handTotal(hers)
    const now: Table = { ...table, deck, hers, herMoves }
    if (total > 21) {
      play.narrate(`${name} hits on ${before}: ${rankWord(card.rank)}. ${total}, bust.`)
      settle(now)
      return
    }
    play.narrate(`${name} hits on ${before}: ${rankWord(card.rank)}. ${total}.`)
    setTable(now)
  }

  // How the match stands, for anything said at the table.
  useEffect(() => {
    if (!her) return
    const mine = handTotal(table.mine).total
    play.situation(
      [
        `The game is heads-up blackjack, ${hands} hand${hands === 1 ? '' : 's'}, no dealer.`,
        `The count of hands is the reader ${score.mine}, ${name} ${score.hers}.`,
        table.phase === 'over'
          ? `Hand ${handNo} has just finished: the reader held ${mine}, ${name} ${handTotal(table.hers).total}.`
          : `In hand ${handNo} the reader holds ${mine}; ${name} ${
              table.turned
                ? `holds ${handTotal(table.hers).total}`
                : `shows ${rankWord(table.hers[0].rank)} with a card face down that only she knows`
            }.`,
        over
          ? 'The last hand has just been played.'
          : table.phase === 'mine'
            ? 'It is the reader to hit or stand.'
            : table.phase === 'hers'
              ? `It is ${name}'s move.`
              : 'The next hand is about to be dealt.',
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // Her move, after a beat, one step at a time.
  useEffect(() => {
    if (!her || table.phase !== 'hers') return
    const timer = setTimeout(herStep, HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Each step changes what she holds, what she has done or whether her card is up.
  }, [table.phase, table.turned, table.hers.length, table.herMoves.length])

  // The next hand, once the last has been looked at and she has said what she had to say.
  useEffect(() => {
    if (!her || table.phase !== 'over' || over || speaking) return
    const timer = setTimeout(() => {
      const next = deal(table.deck, table.done)
      play.narrate(dealLine(name, next.done.length + 1, next.mine, next.hers[0]))
      setTable(next)
    }, NEXT_HAND_MS)
    return () => clearTimeout(timer)
    // A hand ends once, which the count of hands done says.
  }, [table.phase, table.done.length, over, speaking])

  // Blackjack is played against someone; with nobody seated there is no game to draw.
  if (!her) return null

  const waiting = !myTurn || over
  return (
    <div className="vu-blackjack">
      <div className="vu-blackjack-side">
        <p className="vu-blackjack-who">
          {name}
          <span className="vu-blackjack-total">
            {table.turned ? totalWord(table.hers) : '?'}
          </span>
        </p>
        {/* Keyed on the hand, so a new deal lands as new cards. */}
        <Hand key={`hers:${table.done.length - (table.phase === 'over' ? 1 : 0)}`} cards={table.hers} hidden={!table.turned} />
      </div>

      <div className="vu-blackjack-side">
        <Hand key={`mine:${table.done.length - (table.phase === 'over' ? 1 : 0)}`} cards={table.mine} />
        <p className="vu-blackjack-who">
          you
          <span className="vu-blackjack-total">{totalWord(table.mine)}</span>
        </p>
      </div>

      <p className="vu-blackjack-count">
        {`you ${score.mine} · ${name} ${score.hers}`}
        <span className="vu-blackjack-round">
          {over ? 'game over' : `hand ${Math.min(handNo, hands)} of ${hands}`}
        </span>
      </p>

      {/* The moves keep their place when they cannot be made, so the table does not jump. */}
      <div className="vu-blackjack-moves" inert={waiting || undefined} data-waiting={waiting || undefined}>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(waiting, lift, press)}
          onClick={hit}
        >
          Hit
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          {...gestures(waiting, lift, press)}
          onClick={stand}
        >
          Stand
        </motion.button>
      </div>
    </div>
  )
}
