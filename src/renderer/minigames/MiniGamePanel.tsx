import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  CHAT_OPTIONS,
  defaultOptions,
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

/** One thing the table can be opened for: a game alone, or a game a girl is asked to play. */
interface Offer {
  game: MiniGameDef
  /** The girl to ask, or null for a game played alone. */
  charId: string | null
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
        ...(game.players.max >= 1 ? girls.map((charId): Offer => ({ game, charId })) : []),
        ...(game.players.min === 0 ? [{ game, charId: null }] : [])
      ]),
    [offered, girls]
  )

  const [sitting, setSitting] = useState<Sitting | null>(() => sittingOf(agreed))
  const [asking, setAsking] = useState<(Offer & { charId: string }) | null>(null)
  const [words, setWords] = useState('')
  // An agreed game is under way from the moment the table opens: she is sitting at it.
  const [underWay, setUnderWay] = useState(agreed !== null)
  const [result, setResult] = useState<PlayResult | null>(null)

  // The one thing on offer, alone, is the game: nothing to pick.
  const only = offers.length === 1 && offers[0].charId === null ? offers[0].game : null
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
    const character = useGameStore.getState().characters[agreed.charId]
    const game = MINI_GAMES_LIST.find((entry) => entry.id === agreed.gameId)
    if (!character || !game) return
    let live = true
    void skillOf(character, game).then((skill) => {
      if (!live) return
      const opponent: Opponent = {
        charId: agreed.charId,
        name: nameOf(agreed.charId),
        skill: skill.level,
        style: skill.style
      }
      setSitting((now) => (now ? { ...now, opponents: [opponent] } : now))
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
  const [answering, setAnswering] = useState(false)
  function speak(): void {
    const her = seated?.opponents?.[0]
    if (!her || answering || !remark.trim() || result) return
    begin()
    const words = remark
    setRemark('')
    setAnswering(true)
    void readerSaysAtTable(her.charId, situation.current, words).finally(() => setAnswering(false))
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
        return sayAtTable(charId, situation.current, cue)
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
    if (!seated) return
    // Whoever sat down, judged yet or not: she was at the table either way.
    const names = seated.opponents?.map((opponent) => opponent.name) ?? (agreed ? [nameOf(agreed.charId)] : [])
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
    if (offer.charId === null) {
      setSitting({ game: offer.game, opponents: NO_ONE, stake: '', options: defaultOptions(offer.game) })
      return
    }
    setWords(`I ask ${nameOf(offer.charId)} if she wants to play a game of ${offer.game.name}.`)
    setAsking({ game: offer.game, charId: offer.charId })
  }

  function ask(): void {
    if (!asking || !words.trim()) return
    const { game, charId } = asking
    onClose()
    proposeGame(game.id, charId, words)
  }

  if (!host || nothing) return null

  const title = asking ? `Ask ${nameOf(asking.charId)}` : 'Play a game'
  const against = seated?.opponents?.[0]

  /**
   * Where a table hangs so it covers nobody who matters. One girl alone stands in the middle, so
   * it goes beside her. Two stand either side of the middle, which is free. Three leave no room:
   * it hangs over one who is not playing, the middle one unless she is the one at the table.
   */
  const onStage = slots.filter(Boolean).length
  const playing = against?.charId ?? agreed?.charId
  const aside =
    (seated?.game.surface ?? 'table') === 'table' &&
    (onStage === 1 || (onStage >= 3 && playing !== undefined && slots[1] === playing))

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
            <p className="vu-empty">She is getting settled…</p>
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
                      against ? ` with ${against.name}` : agreed ? ` with ${nameOf(agreed.charId)}` : ''
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
              submitDead={answering || !remark.trim() || result !== null}
              inputDead={result !== null}
              focus
              placeholder={
                answering ? `${against.name} is answering…` : `Say something to ${against.name}…`
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
                <li key={`${offer.game.id}:${offer.charId ?? 'alone'}`}>
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
                      {offer.charId ? `ask ${nameOf(offer.charId)} to play` : 'play alone'}
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
                Ask {nameOf(asking.charId)}
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
