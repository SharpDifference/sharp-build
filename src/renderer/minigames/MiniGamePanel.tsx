import { useEffect, useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { MINI_GAMES_LIST, type MiniGameDef } from '@shared/minigames'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScenePanelProps } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
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
  fileResult,
  nameOf,
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
}

/** Nobody at the table but the reader. */
const NO_ONE: Opponent[] = []

/** The sitting a game she agreed to opens on, her skill still to come. */
function sittingOf(agreed: Agreed | null): Sitting | null {
  const game = agreed && MINI_GAMES_LIST.find((entry) => entry.id === agreed.gameId)
  return game ? { game, opponents: null, stake: agreed.stake } : null
}

/**
 * The table a game is played at, over the scene. Opened from the rail it lists what can be
 * played: a game alone starts at once, and a game with a girl is asked for in the reader's own
 * words, as his turn in the scene. Opened on a game she agreed to, it is that game.
 *
 * The framework owns the way out. Before the first move it is free, and the reply being read is
 * left as it was; once a game is under way, leaving is walking away from it and is said in the
 * scene; once it is over, the one answer takes the result back to the scene.
 */
export function MiniGamePanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const offered = useGamesOffered()
  const girls = usePresentGirls()
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
  const seated = sitting ?? (only ? { game: only, opponents: NO_ONE, stake: '' } : null)
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

  const play = useMemo<GamePlay>(
    () => ({
      opponents: seated?.opponents ?? [],
      stake: seated?.stake ?? '',
      // The first move is the reader's turn taken: what the reply had left to say is dropped.
      started: () => {
        takeTurnForGame()
        setUnderWay(true)
      },
      finish: (ended) => setResult(ended)
    }),
    [seated?.opponents, seated?.stake]
  )

  function leave(ended: PlayResult): void {
    fileResult(ended, seated?.stake)
    onClose()
  }

  function pick(offer: Offer): void {
    if (offer.charId === null) {
      setSitting({ game: offer.game, opponents: NO_ONE, stake: '' })
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

  const title = seated ? seated.game.name : asking ? `Ask ${nameOf(asking.charId)}` : 'Play a game'
  const against = seated?.opponents?.[0]

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
          {seated && Game ? (
            seated.opponents ? (
              <>
                {seated.stake && (
                  <p className="vu-minigame-stake">
                    <span className="vu-minigame-stakeword">riding on it</span> {seated.stake}
                  </p>
                )}
                <Game play={play} />
              </>
            ) : (
              <p className="vu-empty">She is getting settled at the table…</p>
            )
          ) : asking ? (
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
          {result ? (
            <motion.button
              id="minigame-done"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              type="button"
              {...gestures(false, lift, press)}
              onClick={() => leave(result)}
            >
              Back to the scene
            </motion.button>
          ) : underWay && seated ? (
            <motion.button
              id="minigame-walk"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, quietLift, quietPress)}
              onClick={() =>
                leave({
                  outcome: 'abandoned',
                  summary: `You walk away from the game of ${seated.game.name}${
                    against ? ` with ${against.name}` : agreed ? ` with ${nameOf(agreed.charId)}` : ''
                  } before it is over.`
                })
              }
            >
              Walk away
            </motion.button>
          ) : asking ? (
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
