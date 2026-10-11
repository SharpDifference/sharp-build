import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  CHAT_OPTIONS,
  defaultOptions,
  groupsFor,
  listed,
  MINI_GAMES,
  MINI_GAMES_LIST,
  type Chattiness,
  type MiniGameDef
} from '@shared/minigames'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScenePanelProps } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { TurnField } from '../views/Dialogue'
import { useModOption } from '../stores/modsStore'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  veilIn
} from '../views/motion'
import { gameComponent, type GamePlay, type Opponent, type PlayResult } from './play'
import { useTableStore, type Agreed } from './session'
import { skillOf } from './skill'
import {
  closeTable,
  compactTable,
  fileResult,
  nameOf,
  narrateAtTable,
  openTable,
  readerSaysAtTable,
  sayAtTable,
  tableQuietIn,
  proposeGame,
  takeTurnForGame,
  useGamesOffered,
  usePresentGirls
} from './table'
import '../vu_styles/MiniGames.css'

/** One thing the table can be opened for: a game alone, or one a girl or several are asked to play. */
interface Offer {
  game: MiniGameDef
  /** The girls to ask; none for a game played alone. */
  charIds: string[]
}

/** What the reader calls the girls asked, in a row. */
function namesOf(charIds: readonly string[]): string {
  return listed(charIds.map(nameOf))
}

/** A game being played: against whom, and for what. */
interface Sitting {
  game: MiniGameDef
  /** Null while a girl's skill is still being judged. */
  opponents: Opponent[] | null
  stake: string
  options: Record<string, number>
}

/** How long a finished game stands on the table before it is cleared. */
const RESULT_BEAT_MS = 1800

/** Nobody at the table but the reader. */
const NO_ONE: Opponent[] = []

/** The sitting a game she agreed to opens on, her skill still to come. */
function sittingOf(agreed: Agreed | null): Sitting | null {
  const game = agreed && MINI_GAMES_LIST.find((entry) => entry.id === agreed.gameId)
  return game ? { game, opponents: null, stake: agreed.stake, options: agreed.options } : null
}

/**
 * The framework's place over a scene, in two shapes.
 *
 * Choosing is a panel: opened from the rail it lists what can be played, and a game with a girl
 * is asked for in the reader's own words, as his turn in the scene.
 *
 * Playing is not: the scene stays lit and the game is drawn on its surface in the middle of it,
 * the girls still standing either side and the dialogue box still the scene's, saying what the
 * game narrates. The framework owns the way out. Before the first move it is free, and the reply
 * being read is left as it was; once a game is under way, leaving is walking away from it and is
 * said in the scene; once it is over, the table clears itself after a beat and the result goes
 * into the scene.
 */
export function MiniGamePanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const offered = useGamesOffered()
  const girls = usePresentGirls()
  // How much she says for herself, as the player has it in the Mods screen.
  const quiet = useModOption(MINI_GAMES, CHAT_OPTIONS.quiet)
  const lots = useModOption(MINI_GAMES, CHAT_OPTIONS.lots)
  const chattiness: Chattiness = quiet ? 'quiet' : lots ? 'lots' : 'some'
  // Who is standing where on the stage: left, middle, right.
  const slots = useGameStore((s) => s.slots)
  // The game she agreed to, taken off the table's own state as the panel opens on it.
  const [agreed] = useState(() => useTableStore.getState().agreed)
  useEffect(() => {
    if (agreed) useTableStore.getState().setAgreed(null)
  }, [agreed])

  const offers = useMemo<Offer[]>(
    () =>
      offered.flatMap((game) => [
        ...(game.players.max >= 1 && game.players.min <= 1
          ? girls.map((charId): Offer => ({ game, charIds: [charId] }))
          : []),
        ...groupsFor(game, girls).map((charIds): Offer => ({ game, charIds })),
        ...(game.players.min === 0 ? [{ game, charIds: [] }] : [])
      ]),
    [offered, girls]
  )

  const [sitting, setSitting] = useState<Sitting | null>(() => sittingOf(agreed))
  const [asking, setAsking] = useState<Offer | null>(null)
  const [words, setWords] = useState('')
  // An agreed game is under way from the moment the table opens: she is sitting at it.
  const [underWay, setUnderWay] = useState(agreed !== null)
  const [result, setResult] = useState<PlayResult | null>(null)

  // The one thing on offer, alone, is the game: nothing to pick.
  const only = offers.length === 1 && offers[0].charIds.length === 0 ? offers[0].game : null
  const seated = useMemo<Sitting | null>(
    () =>
      sitting ??
      (only ? { game: only, opponents: NO_ONE, stake: '', options: defaultOptions(only) } : null),
    [sitting, only]
  )
  const Game = seated ? gameComponent(seated.game.id) : undefined

  // Her skill, judged when she agreed and ready by now more often than not.
  useEffect(() => {
    if (!agreed) return
    const game = MINI_GAMES_LIST.find((entry) => entry.id === agreed.gameId)
    const characters = agreed.charIds
      .map((charId) => useGameStore.getState().characters[charId])
      .filter((character) => character !== undefined)
    if (characters.length === 0 || !game) return
    let live = true
    void Promise.all(
      characters.map(async (character): Promise<Opponent> => {
        const skill = await skillOf(character, game)
        return {
          charId: character.charId,
          name: nameOf(character.charId),
          skill: skill.level,
          style: skill.style
        }
      })
    ).then((opponents) => {
      if (live) setSitting((now) => (now ? { ...now, opponents } : now))
    })
    return () => {
      live = false
    }
  }, [agreed])

  // Nothing to play: the mod was switched off, or the scene moved on.
  const nothing = !seated && offers.length === 0
  useEffect(() => {
    if (nothing) onClose()
  }, [nothing, onClose])

  /** Escape and a click outside leave only a table nothing is at stake on. */
  const dismiss = (): void => {
    if (!underWay && !result) onClose()
  }
  const { host, overlayProps } = useModalShell(dismiss)

  // The first move is the reader's turn taken, once: what the reply had left to say is dropped.
  const begun = useRef(false)
  function begin(): void {
    if (begun.current) return
    begun.current = true
    takeTurnForGame()
    openTable()
    setUnderWay(true)
  }

  // How the game stands, as the game last said it: what she is reminded of when she speaks.
  const situation = useRef('')
  // A table taken down mid-game, by anything, says nothing more.
  useEffect(() => closeTable, [])

  // What the reader says at the table, whenever he likes. The game is not held for it; one
  // remark is out at a time, so her answers come back in the order he spoke.
  const [remark, setRemark] = useState('')
  // Who is answering him, by what he calls her; null with nobody answering.
  const [answering, setAnswering] = useState<string | null>(null)
  // With several at the table, whose turn it is to answer a remark that names nobody.
  const turnToAnswer = useRef(0)
  /** How the game stands as one girl is told it: the game's own words, and who else is playing. */
  function situationFor(charId: string): string {
    const others = (seated?.opponents ?? []).filter((girl) => girl.charId !== charId)
    return others.length === 0
      ? situation.current
      : `${situation.current} Also playing: ${listed(others.map((girl) => girl.name))}.`
  }
  function speak(): void {
    const table = seated?.opponents ?? []
    if (table.length === 0 || answering !== null || !remark.trim() || result) return
    // The girl he names answers; where he names nobody, they take it in turns.
    const said = remark.toLowerCase()
    const her =
      table.find((girl) => girl.name !== 'her' && said.includes(girl.name.toLowerCase())) ??
      table[turnToAnswer.current++ % table.length]
    begin()
    const words = remark
    setRemark('')
    setAnswering(her.name)
    void readerSaysAtTable(her.charId, situationFor(her.charId), words).finally(() =>
      setAnswering(null)
    )
  }

  const play = useMemo<GamePlay>(
    () => ({
      opponents: seated?.opponents ?? [],
      stake: seated?.stake ?? '',
      chattiness,
      options: seated?.options ?? {},
      started: () => begin(),
      narrate: (text) => {
        begin()
        narrateAtTable(text)
      },
      say: (charId, cue) => {
        begin()
        return sayAtTable(charId, situationFor(charId), cue)
      },
      situation: (text) => {
        situation.current = text
      },
      finish: (ended) => setResult(ended)
    }),
    [seated?.opponents, seated?.stake, seated?.options, chattiness]
  )

  function leave(ended: PlayResult): void {
    closeTable()
    compactTable()
    if (!seated) return
    // Whoever sat down, judged yet or not: she was at the table either way.
    const names = seated.opponents?.map((opponent) => opponent.name) ?? (agreed?.charIds ?? []).map(nameOf)
    fileResult(ended, { game: seated.game, names, stake: seated.stake })
    onClose()
  }

  // A finished game stands for a beat, then clears itself: there is nothing to answer.
  useEffect(() => {
    if (!result) return
    // After whatever the table is still saying has been read.
    const timer = setTimeout(() => leave(result), tableQuietIn() + RESULT_BEAT_MS)
    return () => clearTimeout(timer)
    // The result is set once, and what `leave` reads has settled by then.
  }, [result])

  function pick(offer: Offer): void {
    if (offer.charIds.length === 0) {
      setSitting({ game: offer.game, opponents: NO_ONE, stake: '', options: defaultOptions(offer.game) })
      return
    }
    setWords(
      `I ask ${namesOf(offer.charIds)} if ${offer.charIds.length > 1 ? 'they want' : 'she wants'} to play a game of ${offer.game.name}.`
    )
    setAsking(offer)
  }

  function ask(): void {
    if (!asking || !words.trim()) return
    const { game, charIds } = asking
    onClose()
    proposeGame(game.id, charIds, words)
  }

  if (!host || nothing) return null

  const title = asking ? `Ask ${namesOf(asking.charIds)}` : 'Play a game'
  const against = seated?.opponents?.[0]
  /** Everyone at the table, judged yet or not, as the reader calls them. */
  const tableNames =
    seated?.opponents?.map((girl) => girl.name) ?? (agreed?.charIds ?? []).map(nameOf)

  /**
   * Where a table hangs so it covers nobody who matters. One girl alone stands in the middle, so
   * it goes beside her. Two stand either side of the middle, which is free. Three leave no room:
   * it hangs over one who is not playing, the middle one unless she is the one at the table.
   */
  const onStage = slots.filter(Boolean).length
  const playing = seated?.opponents?.map((girl) => girl.charId) ?? agreed?.charIds ?? []
  // With all three at the table there is nobody to spare, and it keeps the middle.
  const aside =
    (seated?.game.surface ?? 'table') === 'table' &&
    (onStage === 1 ||
      (onStage >= 3 && playing.length < onStage && playing.includes(slots[1] ?? '')))

  if (seated && Game) {
    return createPortal(
      <motion.div
        className={`vu-veil vu-minigame-veil${aside ? ' vu-minigame-veil--aside' : ''}`}
        data-theme={theme}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        {...overlayProps}
      >
        <motion.div
          id="minigame-table"
          className={`vu-minigame-surface vu-minigame-surface--${seated.game.surface ?? 'table'} vu-paper`}
          role="dialog"
          aria-modal="true"
          aria-label={seated.game.name}
          initial={{ y: -18, scale: 0.96 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <p className="vu-minigame-name">{seated.game.name}</p>
          {seated.opponents ? (
            <Game play={play} />
          ) : (
            <p className="vu-empty">
              {tableNames.length > 1 ? 'They are getting settled…' : 'She is getting settled…'}
            </p>
          )}
          {/* Standing through the result's beat, dead, so the table does not jump as it ends. */}
          <motion.button
            id="minigame-walk"
            className="vu-pill vu-minigame-leave"
            type="button"
            disabled={result !== null}
            {...gestures(result !== null, quietLift, quietPress)}
            onClick={() =>
              underWay
                ? leave({
                    outcome: 'abandoned',
                    summary: `You walk away from the game of ${seated.game.name}${
                      tableNames.length > 0 ? ` with ${listed(tableNames)}` : ''
                    } before it is over.`
                  })
                : onClose()
            }
          >
            {underWay ? 'Walk away' : 'Not now'}
          </motion.button>
        </motion.div>

        {/* A word across the table, for a game with someone to say it to: the scene's own well,
            where the scene's own stands, and Go beside it. Enter sends from here, the scene's
            own listener being shut out while a table is up. */}
        {against && (
          <div
            className="vu-turn vu-scene-row"
            data-well="out"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return
              event.stopPropagation()
              speak()
            }}
          >
            {/* The scene's row has its tips mark before the well and the gift after Go. Neither
                is offered at the table, and both keep their room, so the well stands exactly
                where the scene's does. */}
            <span className="vu-scene-help vu-minigame-room" aria-hidden="true" />
            <TurnField
              action={remark}
              onAction={setRemark}
              onSubmit={speak}
              sending={false}
              submitDead={answering !== null || !remark.trim() || result !== null}
              inputDead={result !== null}
              focus={!seated.game.keys}
              placeholder={
                answering !== null
                  ? `${answering} is answering…`
                  : tableNames.length > 1
                    ? 'Say something to the table…'
                    : `Say something to ${against.name}…`
              }
              multiline
            />
            <span className="vu-scene-gift vu-minigame-room" aria-hidden="true">
              <span className="vu-scene-giftseat">
                <span className="vu-deadnote">
                  <span className="vu-scene-rule" />
                  <span className="vu-scene-giftbtn">
                    <svg width="20" height="20" />
                  </span>
                </span>
              </span>
            </span>
          </div>
        )}
      </motion.div>,
      host
    )
  }

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id="minigame-panel"
        className="vu-sheet vu-minigame vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        variants={panelUnderTab}
      >
        <TitleTab>{title}</TitleTab>

        <div className="vu-minigame-body">
          {asking ? (
            <form
              className="vu-minigame-ask"
              onSubmit={(event) => {
                event.preventDefault()
                ask()
              }}
              // Enter asks, as it sends a turn in the scene; Shift+Enter still breaks a line.
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return
                event.preventDefault()
                event.stopPropagation()
                ask()
              }}
            >
              <TextField
                id="minigame-ask-text"
                label="What you say"
                hint="Your turn in the scene. Say it your way, and name what is riding on it if you like. She may say no."
                value={words}
                onChange={setWords}
                maxLength={400}
                multiline
                rows={3}
                autoFocus
              />
            </form>
          ) : (
            <ul className="vu-rows">
              {offers.map((offer) => (
                <li key={`${offer.game.id}:${offer.charIds.join('+') || 'alone'}`}>
                  <motion.button
                    type="button"
                    className="vu-row vu-minigame-pick"
                    {...gestures(false, rowLift, rowPress)}
                    onClick={() => pick(offer)}
                  >
                    <span className="vu-minigame-pickicon" aria-hidden="true">
                      {offer.game.icon}
                    </span>
                    <span className="vu-minigame-pickname">{offer.game.name}</span>
                    <span className="vu-minigame-pickblurb">
                      {offer.charIds.length > 0 ? `ask ${namesOf(offer.charIds)} to play` : 'play alone'}
                    </span>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="vu-foot">
          {asking ? (
            <>
              <motion.button
                id="minigame-back"
                className="vu-btn vu-btn--quiet"
                type="button"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => setAsking(null)}
              >
                Back
              </motion.button>
              <motion.button
                id="minigame-ask"
                className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                type="button"
                disabled={!words.trim()}
                {...gestures(!words.trim(), lift, press)}
                onClick={ask}
              >
                Ask {namesOf(asking.charIds)}
              </motion.button>
            </>
          ) : (
            <motion.button
              id="minigame-close"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={onClose}
            >
              Not now
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
