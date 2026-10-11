import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  HANDS,
  RESHUFFLE_UNDER,
  drawCard,
  gameOutcome,
  gameOver,
  girlMove,
  handTotal,
  isNatural,
  remarkBy,
  soundAt,
  tableAccount,
  tableDeal,
  tableResult,
  tableSummary,
  tableTold,
  tableWon,
  totalWord,
  type HerMoveMade,
  type HitMade,
  type TableHand
} from '@shared/minigameRules/blackjack'
import { freshDeck, rankMark, rankWord, type Card, type Suit } from '@shared/minigameKit'
import { listed } from '@shared/minigameKit'
import { gestures, lift, press } from '../kit'
import { BunnyMark } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/Blackjack.css'

const SUIT_MARK: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

/** How many times in a game the girls say something about a hand, between them, by how talkative they are to be. */
const REMARKS = { quiet: 0, some: 2, lots: 5 } as const

/** How long she takes over a move: long enough for the last one to be read first. */
const HER_PAUSE_MS = 1700

/** The same around a fuller table, where a hand is many moves: quicker, so the reader is not kept waiting. */
const GIRLS_PAUSE_MS = 1000

/** How long a finished hand lies on the table before the next is dealt. */
const NEXT_HAND_MS = 2400

/** The longest the next hand waits on something being said: her line may land over the deal. */
const SAY_WAIT_MS = 3000

/** The least a hand lies there once the wait for her line is over. */
const AFTER_REMARK_MS = 600

/** A girl's side of the hand on the table. */
interface Seat {
  cards: Card[]
  moves: HerMoveMade[]
  /** Her face-down card has been turned. */
  turned: boolean
}

/** The hand on the table: whose move it is, and how each got to what they hold. */
interface Table {
  deck: Card[]
  mine: Card[]
  hits: HitMade[]
  /** The girls' sides, in the order they play. */
  seats: Seat[]
  /** Whose move it is, or `over` once the hand is settled. */
  phase: 'mine' | 'girls' | 'over'
  /** The girl to move, while it is the girls' turn. */
  at: number
  /** The hands already finished, this one among them once it is over. */
  done: TableHand[]
}

/**
 * A new hand off the deck for the reader and `girls` girls: a card each, twice, the reader's
 * first. A two-card 21 of his plays itself.
 */
function deal(from: readonly Card[], done: TableHand[], girls: number): Table {
  const players = girls + 1
  const deck = from.length < (RESHUFFLE_UNDER / 2) * players ? freshDeck() : [...from]
  const mine = [deck[0], deck[players]]
  return {
    deck: deck.slice(players * 2),
    mine,
    seats: Array.from({ length: girls }, (_, i) => ({
      cards: [deck[i + 1], deck[players + i + 1]],
      moves: [],
      turned: false
    })),
    hits: [],
    phase: isNatural(mine) ? 'girls' : 'mine',
    at: 0,
    done
  }
}

/** Every card on the table: none of them may come off a deck cut mid-hand. */
function inPlay(table: Table): Card[] {
  return [...table.mine, ...table.seats.flatMap((seat) => seat.cards)]
}

/** The count of hands as the narration says it: "You 1, Ana 0, Bea 2". */
function countLine(me: string, names: readonly string[], won: readonly number[]): string {
  return [me, ...names].map((name, seat) => `${name} ${won[seat]}`).join(', ')
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

/**
 * One side's cards in a row, each landing as it is dealt; `hidden` is her card still face down.
 * `small` is a hand at a table of several girls, which closes up sooner.
 */
function Hand({
  cards,
  hidden,
  small
}: {
  cards: readonly Card[]
  hidden?: boolean
  small?: boolean
}): JSX.Element {
  return (
    <div
      className="vu-blackjack-hand"
      data-many={cards.length > (small ? 2 : 4) || undefined}
      // How many cards the hand is, for the fan to share its width between.
      style={{ '--vu-blackjack-cards': cards.length } as CSSProperties}
    >
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
 * Blackjack with no dealer, heads-up or with two or three girls, everyone against everyone: a
 * few hands, each a card or two towards 21. The reader hits or stands first; each girl in turn
 * then turns her face-down card and plays knowing the hands finished before hers, at her skill.
 * Most hands won takes the game. What happens is said in the scene's dialogue box; the table
 * shows the hands and the count.
 */
export function Blackjack({ play }: { play: GamePlay }): JSX.Element | null {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const several = girls.length > 1
  // Three hands unless the table settled on another number.
  const hands = play.options.hands ?? HANDS
  const [table, setTable] = useState<Table>(() => deal(freshDeck(), [], girls.length))
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
  const score = tableWon(table.done, girls.length)
  const over = gameOver(score, table.done.length, hands)
  const handNo = table.done.length + (table.phase === 'over' ? 0 : 1)
  const myTurn = table.phase === 'mine'
  const mover = table.phase === 'girls' ? table.seats[table.at] : undefined

  // The game is on from the moment they sit down, and the first deal is said.
  useEffect(() => {
    if (!seated) return
    // On the next tick, so a mount that is at once undone and redone (StrictMode's) says it once.
    const timer = setTimeout(() => {
      play.narrate(
        `${names[0]} shuffles and deals${several ? ` for ${listed(['you', ...names.slice(1), 'herself'])}` : ''}. ${hands === 1 ? 'One hand decides it' : several ? `${hands} hands, most won takes it` : `Best of ${hands} hands`}, your move first each time.`
      )
      play.narrate(tableDeal(names, 1, table.mine, table.seats.map((seat) => seat.cards[0])))
    }, 0)
    return () => clearTimeout(timer)
    // Once, as the table opens.
  }, [])

  /** The hand is settled: its result is said, and the game either ends or goes on. */
  function settle(now: Table): void {
    if (finished.current) return
    settledAt.current = performance.now()
    const hand: TableHand = {
      mine: now.mine,
      hits: now.hits,
      girls: now.seats.map((seat) => ({ cards: seat.cards, moves: seat.moves }))
    }
    const done = [...table.done, hand]
    const won = tableWon(done, girls.length)
    play.narrate(`${tableResult(names, hand)} ${countLine('You', names, won)}.`)
    setTable({
      ...now,
      phase: 'over',
      seats: now.seats.map((seat) => ({ ...seat, turned: true })),
      done
    })
    if (!gameOver(won, done.length, hands)) {
      remark(done)
      return
    }
    finished.current = true
    play.finish({
      outcome: gameOutcome(won),
      summary: tableSummary(names, won),
      account: tableAccount(names, done, hands)
    })
  }

  /**
   * Has one of the girls say something about the hand just finished, where it is worth it: a
   * two-card 21, a hand taken by a point, a bust that matters, or the next hand being the one
   * that decides it. A few times a game at most between them all, one voice a hand, and never
   * on the last hand, which the scene's own reply answers. The one who took the hand speaks for
   * herself; otherwise it is whoever the hand touched most, the word going round among equals.
   */
  function remark(done: readonly TableHand[]): void {
    if (!seated || remarks.current >= REMARKS[play.chattiness]) return
    const last = done[done.length - 1]
    const told = tableTold(names, last, done.length)
    const won = tableWon(done, girls.length)
    const [first, second = 0] = [...won].sort((a, b) => b - a)
    const deciding = done.length + 1 === hands && first - second <= 1
    // Talkative, they have a word for an ordinary hand too.
    if (!told.notable && !deciding && play.chattiness !== 'lots') return
    remarks.current++
    const by = remarkBy(last, spoken.current)
    spoken.current[by] = (spoken.current[by] ?? 0) + 1
    const cue = `${told.line} That makes it ${countLine('the reader', names, won)}.${deciding ? ' The next hand is the last and decides it.' : ''}`
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

  function hit(): void {
    if (!myTurn || finished.current) return
    const before = handTotal(table.mine)
    const [card, deck] = drawCard(table.deck, Math.random, inPlay(table))
    const mine = [...table.mine, card]
    const { total } = handTotal(mine)
    const now: Table = { ...table, deck, mine, hits: [...table.hits, before] }
    if (total > 21) {
      play.narrate(`You hit on ${before.total}: ${rankWord(card.rank)}. ${total}, bust.`)
      // Heads-up his bust is her hand as it lies; around a table the girls play on for it.
      if (several) setTable({ ...now, phase: 'girls' })
      else settle(now)
      return
    }
    play.narrate(
      `You hit on ${before.total}: ${rankWord(card.rank)}. ${total}${total === 21 ? ', and you stand' : ''}.`
    )
    // Nothing is left to draw for on 21: it is the girls' turn.
    setTable({ ...now, phase: total === 21 ? 'girls' : 'mine' })
  }

  function stand(): void {
    if (!myTurn || finished.current) return
    play.narrate(`You stand on ${handTotal(table.mine).total}.`)
    setTable({ ...table, phase: 'girls' })
  }

  /**
   * The next step of the girl whose turn it is: her face-down card first, then a move at a time
   * until she stands or busts, which passes the turn to the next girl or settles the hand.
   */
  function girlStep(): void {
    const at = table.at
    const seat = table.seats[at]
    if (!seat || finished.current || !live.current) return
    const name = names[at]
    const put = (next: Seat): Seat[] => table.seats.map((other, i) => (i === at ? next : other))
    if (!seat.turned) {
      play.narrate(
        `${name} turns her card: ${rankWord(seat.cards[1].rank)}. She has ${totalWord(seat.cards)}.`
      )
      setTable({ ...table, seats: put({ ...seat, turned: true }) })
      return
    }
    /** Her hand is finished: the next girl's turn, or the end of the hand. */
    const pass = (now: Table): void => {
      if (at + 1 < now.seats.length) setTable({ ...now, at: at + 1 })
      else settle(now)
    }
    // What she can see: every hand finished before hers, and one card of each still to come.
    const shown = [table.mine, ...table.seats.slice(0, at).map((other) => other.cards)]
    const behind = table.seats.slice(at + 1).map((other) => other.cards[0])
    const before = handTotal(seat.cards).total
    const move = girlMove(seat.cards, shown, behind, girls[at].skill)
    const made: HerMoveMade = { move, total: before, sound: soundAt(seat.cards, shown, behind) }
    const moves = [...seat.moves, made]
    if (move === 'stand') {
      play.narrate(`${name} stands on ${before}.`)
      pass({ ...table, seats: put({ ...seat, moves }) })
      return
    }
    const [card, deck] = drawCard(table.deck, Math.random, inPlay(table))
    const cards = [...seat.cards, card]
    const { total } = handTotal(cards)
    const now: Table = { ...table, deck, seats: put({ ...seat, cards, moves }) }
    if (total > 21) {
      play.narrate(`${name} hits on ${before}: ${rankWord(card.rank)}. ${total}, bust.`)
      pass(now)
      return
    }
    play.narrate(`${name} hits on ${before}: ${rankWord(card.rank)}. ${total}.`)
    setTable(now)
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (!seated) return
    const mine = handTotal(table.mine).total
    const holds = table.seats.map((seat, i) => {
      const { total } = handTotal(seat.cards)
      if (table.phase === 'over') return `${names[i]} ${total}`
      if (!seat.turned) {
        return `${names[i]} shows ${rankWord(seat.cards[0].rank)} with a card face down that only she knows`
      }
      return `${names[i]} ${total > 21 ? `has bust with ${total}` : `holds ${total}`}`
    })
    play.situation(
      [
        `The game is ${several ? `blackjack between the reader, ${listed(names)}, everyone against everyone` : 'heads-up blackjack'}, ${hands} hand${hands === 1 ? '' : 's'}, no dealer.`,
        `The count of hands is ${countLine('the reader', names, score)}.`,
        table.phase === 'over'
          ? `Hand ${handNo} has just finished: the reader held ${mine}, ${holds.join(', ')}.`
          : `In hand ${handNo} the reader ${mine > 21 ? `has bust with ${mine}` : `holds ${mine}`}; ${holds.join('; ')}.`,
        over
          ? 'The last hand has just been played.'
          : table.phase === 'mine'
            ? 'It is the reader to hit or stand.'
            : table.phase === 'girls'
              ? `It is ${names[table.at]}'s move.`
              : 'The next hand is about to be dealt.',
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  })

  // The girls' moves, after a beat, one step at a time.
  useEffect(() => {
    if (!mover) return
    const timer = setTimeout(girlStep, several ? GIRLS_PAUSE_MS : HER_PAUSE_MS)
    return () => clearTimeout(timer)
    // Each step changes whose turn it is, what she holds, what she has done or whether her card is up.
  }, [table.phase, table.at, mover?.turned, mover?.cards.length, mover?.moves.length])

  // The next hand, once the last has been looked at and whoever spoke has said what she had to say.
  useEffect(() => {
    if (!seated || table.phase !== 'over' || over || speaking) return
    // Counted from when the hand was settled, so time spent waiting on her line is not added to.
    const lain = performance.now() - settledAt.current
    const timer = setTimeout(() => {
      if (finished.current) return
      const next = deal(table.deck, table.done, girls.length)
      play.narrate(
        tableDeal(names, next.done.length + 1, next.mine, next.seats.map((seat) => seat.cards[0]))
      )
      setTable(next)
    }, Math.max(NEXT_HAND_MS - lain, AFTER_REMARK_MS))
    return () => clearTimeout(timer)
    // A hand ends once, which the count of hands done says.
  }, [table.phase, table.done.length, over, speaking])

  // Blackjack is played against someone; with nobody seated there is no game to draw.
  if (!seated) return null

  const waiting = !myTurn || over
  // Which hand is on the table, so a new deal lands as new cards.
  const dealt = table.done.length - (table.phase === 'over' ? 1 : 0)
  return (
    <div className="vu-blackjack">
      <div className="vu-blackjack-girls" data-several={several || undefined}>
        {table.seats.map((seat, i) => (
          <div
            key={girls[i].charId}
            className="vu-blackjack-side"
            data-turn={(table.phase === 'girls' && table.at === i) || undefined}
          >
            <p className="vu-blackjack-who">
              {names[i]}
              <span className="vu-blackjack-total">{seat.turned ? totalWord(seat.cards) : '?'}</span>
            </p>
            <Hand key={`hers:${dealt}`} cards={seat.cards} hidden={!seat.turned} small={several} />
            {several && <p className="vu-blackjack-won">{`${score[i + 1]} won`}</p>}
          </div>
        ))}
      </div>

      <div className="vu-blackjack-side" data-turn={(myTurn && !over) || undefined}>
        <Hand key={`mine:${dealt}`} cards={table.mine} />
        <p className="vu-blackjack-who">
          you
          <span className="vu-blackjack-total">{totalWord(table.mine)}</span>
        </p>
      </div>

      <p className="vu-blackjack-count">
        {several
          ? `you ${score[0]} won`
          : `you ${score[0]} · ${names[0]} ${score[1]}`}
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
