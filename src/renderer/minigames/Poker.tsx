import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { freshDeck, rankMark, type Card, type Suit } from '@shared/highLow'
import { listed } from '@shared/minigames'
import {
  BIG_BLIND,
  SMALL_BLIND,
  act,
  actionLine,
  chipsLine,
  cardWord,
  dealHand,
  dealLine,
  evaluate,
  gameOutcome,
  gameOver,
  girlAction,
  handName,
  handTold,
  holeWord,
  legal,
  nextButton,
  owedBy,
  pokerAccount,
  pokerSummary,
  potOf,
  proceed,
  remarkBy,
  resultLines,
  startingStack,
  streetLine,
  type HandState,
  type Move
} from '@shared/poker'
import { gestures, lift, press } from '../views/motion'
import { BunnyMark } from '../views/screenIcons'
import type { GamePlay } from './play'
import '../vu_styles/Poker.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** How many times in a game the girls say something about a hand, between them, by how talkative they are to be. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const

/** How long a girl takes over a move: long enough for the last one to be read first. */
const GIRL_MS = 1300

/** The same once the reader has folded and is only watching. */
const WATCHING_MS = 800

/** How long the betting stays closed before the next street is dealt, or the hands are shown. */
const STREET_MS = 1300

/** How long a finished hand lies on the table before the next is dealt. */
const NEXT_HAND_MS = 2800

/** The longest the next hand waits on something being said: her line may land over the deal. */
const SAY_WAIT_MS = 3000

/** The least a hand lies there once the wait for her line is over. */
const AFTER_REMARK_MS = 600

/** The table: the hand on it, and the hands already finished, this one among them once it is over. */
interface Table {
  hand: HandState
  done: HandState[]
}

function CardFace({ card }: { card: Card }): JSX.Element {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span
      className={`vu-poker-card${red ? ' vu-poker-card--red' : ''}`}
      aria-label={`${rankMark(card.rank)} of ${card.suit}`}
    >
      <span className="vu-poker-rank">{rankMark(card.rank)}</span>
      <span className="vu-poker-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  )
}

function CardBack(): JSX.Element {
  return (
    <span className="vu-poker-back" aria-label="a card face down">
      <BunnyMark />
    </span>
  )
}

/** A card landing where it is dealt. */
function Dealt({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <motion.span
      className="vu-poker-slot"
      initial={{ opacity: 0, y: -14, rotate: -5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
    >
      {children}
    </motion.span>
  )
}

/** What a seat last did on this street, or how it stands in the hand, in a word or two. */
function standingOf(hand: HandState, at: number): string {
  const seat = hand.seats[at]
  if (seat.out) return 'out'
  if (hand.over) {
    const won = hand.pots.some((pot) => pot.winners.includes(at))
    return seat.folded ? 'folded' : won ? 'wins' : ''
  }
  if (seat.folded) return 'folded'
  if (seat.allIn) return 'all-in'
  const last = [...hand.log].reverse().find((made) => made.seat === at && made.street === hand.street)
  if (!last) return hand.toAct === at ? 'to act' : ''
  if (hand.toAct === at) return 'to act'
  return last.kind === 'check' ? 'checks' : last.kind === 'call' ? 'calls' : last.kind === 'bet' ? 'bets' : 'raises'
}

/** The seat's place in the deal: the button, a blind, or nothing. */
function placeOf(hand: HandState, at: number): string {
  const marks = [
    ...(hand.button === at ? ['D'] : []),
    ...(hand.smallBlind === at ? ['SB'] : hand.bigBlind === at ? ['BB'] : [])
  ]
  return marks.join(' · ')
}

/**
 * Texas hold'em for play chips, heads-up or with two or three girls, each for herself. Everyone
 * starts with the same stack; a set number of hands is played, or fewer if the reader loses his
 * chips or one player takes them all, and the most chips at the end wins. The reader folds,
 * checks or calls, or bets half the pot, the pot or everything; each girl plays her own hand at
 * her skill. What happens is said in the scene's dialogue box; the board shows the cards, the
 * chips and the pot.
 */
export function Poker({ play }: { play: GamePlay }): JSX.Element | null {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const hands = play.options.hands ?? 5
  const stack = startingStack(play.options.stack ?? 2)
  const [table, setTable] = useState<Table>(() => ({
    // The last girl deals the first hand, and the button goes round from her.
    hand: dealHand(
      Array.from({ length: girls.length + 1 }, () => stack),
      girls.length,
      1,
      freshDeck()
    ),
    done: []
  }))
  // One of them is saying something about the last hand: the next one waits for it.
  const [speaking, setSpeaking] = useState(false)
  const remarks = useRef(0)
  // How often each girl has had the word, so that it goes round.
  const spoken = useRef<number[]>([])
  // The framework may clear the table at any moment; nothing is set on one that is gone.
  const live = useRef(true)
  // The game has been handed back: nothing more is said or played.
  const finished = useRef(false)
  // Which remark the table is waiting on, and the timer that ends the wait.
  const awaited = useRef(0)
  const sayCap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // When the hand on the table was settled.
  const settledAt = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTimeout(sayCap.current)
    }
  }, [])

  const seated = girls.length > 0
  const { hand, done } = table
  const chips = hand.seats.map((seat) => seat.stack)
  const over = hand.over && gameOver(chips, done.length, hands)
  const myTurn = hand.toAct === 0 && !hand.over
  const can = legal(hand, 0)

  // The game is on from the moment they sit down, and the first deal is said.
  useEffect(() => {
    if (!seated) return
    // On the next tick, so a mount that is at once undone and redone (StrictMode's) says it once.
    const timer = setTimeout(() => {
      const dealer = names[names.length - 1]
      play.narrate(
        `${dealer} shuffles and deals hold'em for ${listed(['you', ...names.slice(0, -1), 'herself'])}: ${stack} in play chips each, blinds ${SMALL_BLIND} and ${BIG_BLIND}, up to ${hands} hands, and the most chips at the end wins.`
      )
      play.narrate(dealLine(names, hand))
    }, 0)
    return () => clearTimeout(timer)
    // Once, as the table opens.
  }, [])

  /** The hand has moved on: what happened is said, and where it ended the hand is closed. */
  function carry(next: HandState, line?: string): void {
    if (line) play.narrate(line)
    if (!next.over) {
      setTable({ hand: next, done })
      return
    }
    settledAt.current = performance.now()
    for (const said of resultLines(names, next)) play.narrate(said)
    const all = [...done, next]
    setTable({ hand: next, done: all })
    const stacks = next.seats.map((seat) => seat.stack)
    if (!gameOver(stacks, all.length, hands)) {
      remark(all)
      return
    }
    finished.current = true
    play.finish({
      outcome: gameOutcome(stacks),
      summary: pokerSummary(names, stacks, all.length),
      account: pokerAccount(names, all, stack, hands)
    })
  }

  /**
   * Has one of the girls say something about the hand just finished, where it is worth it: a
   * bluff that worked or was caught, a bad beat or a bad call, an all-in, a big pot, somebody
   * losing her last chip. A few times a game at most between them all, one voice a hand, and
   * never on the last hand, which the scene's own reply answers. She is told what the table
   * saw, and of what stayed hidden only her own cards.
   */
  function remark(all: readonly HandState[]): void {
    if (remarks.current >= REMARKS[play.chattiness]) return
    const last = all[all.length - 1]
    const told = handTold(names, last, stack)
    // Talkative, they have a word for an ordinary hand too.
    if (!told.notable && play.chattiness !== 'lots') return
    remarks.current++
    const by = remarkBy(last, spoken.current)
    spoken.current[by] = (spoken.current[by] ?? 0) + 1
    const hers = last.seats[by + 1]
    const own = hers.out
      ? ` ${names[by]} was already out of chips and only watched.`
      : last.showdown && !hers.folded
        ? ''
        : told.bluffer === by + 1
          ? ` ${names[by]} herself held ${holeWord(hers.hole)}: she was bluffing, which nobody else at the table knows.`
          : ` ${names[by]} herself held ${holeWord(hers.hole)}, which nobody else saw.`
    const stacks = last.seats.map((seat) => seat.stack)
    const cue = `${told.seen}${own} The chips now: ${chipsLine(names, stacks, 'the reader')}.${all.length + 1 === hands ? ' The next hand is the last.' : ''}`
    // The next hand waits for her line, but not for long: a slow one lands over the deal.
    const mine = ++awaited.current
    const release = (): void => {
      if (!live.current || awaited.current !== mine) return
      awaited.current++
      clearTimeout(sayCap.current)
      setSpeaking(false)
    }
    setSpeaking(true)
    clearTimeout(sayCap.current)
    sayCap.current = setTimeout(release, SAY_WAIT_MS)
    void Promise.resolve()
      .then(() => play.say(girls[by].charId, cue))
      .then(release, release)
  }

  /** The seat to act makes a move, and it is said. */
  function move(made: Move): void {
    if (finished.current || !live.current || hand.over || hand.toAct === null) return
    const next = act(hand, made)
    carry(next, actionLine(names, next.log[next.log.length - 1]))
  }

  /** The reader's move, from one of his buttons. */
  function mine(made: Move): void {
    if (myTurn) move(made)
  }

  /** The next thing that happens without the reader: a girl's move, a street, or the showdown. */
  function step(): void {
    if (finished.current || !live.current || hand.over) return
    if (hand.toAct === null) {
      const next = proceed(hand)
      carry(next, next.board.length > hand.board.length ? streetLine(next) : undefined)
      return
    }
    if (hand.toAct === 0) return
    const girl = girls[hand.toAct - 1]
    move(girlAction(hand, hand.toAct, girl.skill, girl.style))
  }

  // How the game stands, for anything said at the table. Nobody's hidden cards are in it.
  useEffect(() => {
    if (!seated) return
    const who = (seat: number): string => (seat === 0 ? 'the reader' : names[seat - 1])
    const state = hand.seats.flatMap((seat, i) =>
      seat.out ? [`${who(i)} is out of chips`] : seat.folded ? [`${who(i)} has folded`] : seat.allIn && !hand.over ? [`${who(i)} is all-in`] : []
    )
    play.situation(
      [
        `The game is Texas hold'em for play chips between the reader and ${listed(names)}, each for herself: ${hands} hands at most, blinds ${SMALL_BLIND} and ${BIG_BLIND}, everyone started with ${stack}, and the most chips at the end wins. The chips are only counters.`,
        `Chips: ${chipsLine(names, chips, 'the reader')}.`,
        hand.over
          ? `Hand ${hand.no} has just finished.`
          : `Hand ${hand.no} is being played: ${hand.board.length ? `the board shows ${listed(hand.board.map(cardWord))}` : 'no cards are on the board yet'}, and the pot is ${potOf(hand)}.${state.length ? ` ${state.join('; ')}.` : ''}`,
        over
          ? 'The last hand has just been played.'
          : hand.over
            ? 'The next hand is about to be dealt.'
            : hand.toAct === null
              ? 'The betting is closed and the next card is about to come.'
              : `It is ${who(hand.toAct)}'s move${owedBy(hand, hand.toAct) > 0 ? `, with ${owedBy(hand, hand.toAct)} to call` : ''}.`,
        'Everyone keeps her own two cards to herself: nobody says what she holds while a hand is on, and a folded hand is never shown.',
        ...(play.stake ? [`Riding on the game: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // The girls' moves and the cards to come, after a beat, one step at a time.
  useEffect(() => {
    if (!seated || hand.over || hand.toAct === 0) return
    const wait = hand.toAct === null ? STREET_MS : hand.seats[0].folded || hand.seats[0].out ? WATCHING_MS : GIRL_MS
    const timer = setTimeout(step, wait)
    return () => clearTimeout(timer)
    // Every step puts a new hand on the table.
  }, [hand])

  // The next hand, once the last has been looked at and whoever spoke has said what she had to say.
  useEffect(() => {
    if (!seated || !hand.over || over || speaking) return
    // Counted from when the hand was settled, so time spent waiting on her line is not added to.
    const lain = performance.now() - settledAt.current
    const timer = setTimeout(() => {
      if (finished.current) return
      const stacks = hand.seats.map((seat) => seat.stack)
      const next = dealHand(stacks, nextButton(stacks, hand.button), hand.no + 1, freshDeck())
      play.narrate(dealLine(names, next))
      setTable({ hand: next, done })
    }, Math.max(NEXT_HAND_MS - lain, AFTER_REMARK_MS))
    return () => clearTimeout(timer)
    // A hand ends once, which the hand itself says.
  }, [hand, over, speaking])

  // Poker is played against someone; with nobody seated there is no game to draw.
  if (!seated) return null

  const waiting = !myTurn
  const me = hand.seats[0]
  const pot = potOf(hand)
  const winners = new Set(hand.over ? hand.pots.flatMap((each) => each.winners) : [])
  const held =
    !me.out && hand.board.length >= 3 ? handName(evaluate([...me.hole, ...hand.board])) : !me.out ? holeWord(me.hole) : ''
  const raising = hand.currentBet > 0
  // A size that comes to the same as a bigger one is left to the bigger one's button.
  const sizes = [
    { id: 'half', label: 'Half pot', to: can.halfTo, dead: can.halfTo >= can.potTo },
    { id: 'pot', label: 'Pot', to: can.potTo, dead: can.potTo >= can.maxTo },
    { id: 'all', label: 'All-in', to: can.maxTo, dead: false }
  ]

  return (
    <div className="vu-poker">
      <div className="vu-poker-girls">
        {girls.map((girl, i) => {
          const at = i + 1
          const seat = hand.seats[at]
          const up = hand.over && hand.showdown && !seat.folded && !seat.out
          return (
            <div
              key={girl.charId}
              className="vu-poker-seat"
              data-turn={(hand.toAct === at && !hand.over) || undefined}
              data-gone={seat.folded || seat.out || undefined}
              data-won={winners.has(at) || undefined}
            >
              <p className="vu-poker-who">
                {girl.name}
                <span className="vu-poker-place">{placeOf(hand, at)}</span>
              </p>
              <div className="vu-poker-hole" key={`${hand.no}:${up ? 'up' : 'down'}`}>
                {seat.out ? (
                  <span className="vu-poker-empty" />
                ) : (
                  seat.hole.map((card, k) => (
                    <Dealt key={k}>{up ? <CardFace card={card} /> : <CardBack />}</Dealt>
                  ))
                )}
              </div>
              <p className="vu-poker-chips">
                {seat.stack}
                <span className="vu-poker-bet">{seat.bet > 0 ? `in ${seat.bet}` : ''}</span>
              </p>
              <p className="vu-poker-state">
                {up ? handName(evaluate([...seat.hole, ...hand.board])) : standingOf(hand, at)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="vu-poker-middle">
        <div className="vu-poker-board" key={hand.no}>
          {Array.from({ length: 5 }, (_, i) =>
            hand.board[i] ? (
              <Dealt key={i}>
                <CardFace card={hand.board[i]} />
              </Dealt>
            ) : (
              <span key={i} className="vu-poker-slot">
                <span className="vu-poker-empty" />
              </span>
            )
          )}
        </div>
        <p className="vu-poker-pot">
          {hand.over ? 'pot won' : 'pot'} {hand.over ? hand.pots.reduce((sum, each) => sum + each.amount, 0) : pot}
          <span className="vu-poker-round">
            {over ? 'game over' : `hand ${hand.no} of ${hands} · blinds ${SMALL_BLIND}/${BIG_BLIND}`}
          </span>
        </p>
      </div>

      <div
        className="vu-poker-seat vu-poker-seat--mine"
        data-turn={myTurn || undefined}
        data-gone={me.folded || me.out || undefined}
        data-won={winners.has(0) || undefined}
      >
        <div className="vu-poker-hole" key={hand.no}>
          {me.out ? (
            <span className="vu-poker-empty" />
          ) : (
            me.hole.map((card, k) => (
              <Dealt key={k}>
                <CardFace card={card} />
              </Dealt>
            ))
          )}
        </div>
        <div className="vu-poker-mine">
          <p className="vu-poker-who">
            you
            <span className="vu-poker-place">{placeOf(hand, 0)}</span>
          </p>
          <p className="vu-poker-chips">
            {me.stack}
            <span className="vu-poker-bet">{me.bet > 0 ? `in ${me.bet}` : ''}</span>
          </p>
          <p className="vu-poker-state">{me.folded ? 'folded' : held}</p>
        </div>
      </div>

      {/* The moves keep their place when they cannot be made, so the board does not jump. */}
      <div className="vu-poker-moves" inert={waiting || undefined} data-waiting={waiting || undefined}>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          disabled={waiting || can.canCheck}
          {...gestures(waiting || can.canCheck, lift, press)}
          onClick={() => mine({ kind: 'fold' })}
        >
          Fold
        </motion.button>
        <motion.button
          type="button"
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
          disabled={waiting}
          {...gestures(waiting, lift, press)}
          onClick={() => mine({ kind: 'call' })}
        >
          {can.canCheck || waiting ? 'Check' : `Call ${can.owed}`}
        </motion.button>
        <span className="vu-poker-sizes">
          <span className="vu-poker-sizing">{raising ? 'raise to' : 'bet'}</span>
          {sizes.map((size) => {
            const dead = waiting || !can.canRaise || size.dead
            return (
              <motion.button
                key={size.id}
                type="button"
                className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
                disabled={dead}
                {...gestures(dead, lift, press)}
                onClick={() => mine({ kind: 'raise', to: size.to })}
              >
                {size.label}
                <span className="vu-poker-amount">{waiting || !can.canRaise ? '' : size.to}</span>
              </motion.button>
            )
          })}
        </span>
      </div>
    </div>
  )
}
