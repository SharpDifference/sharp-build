import { useEffect, useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import type { MiniGameDef } from '@shared/minigames'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScenePanelProps } from '../mods/hooks'
import { gestures, lift, panelUnderTab, press, rowLift, rowPress, veilIn } from '../views/motion'
import { gameComponent, type GamePlay, type PlayResult } from './play'
import { fileResult, takeTurnForGame, useGamesOffered } from './table'
import '../vu_styles/MiniGames.css'

/**
 * The table a game is played at, over the scene: the list of games where there is a choice, then
 * the game itself. The framework owns the way out. Before the first move it is free, and the
 * reply being read is left as it was; once a game is under way, leaving is walking away from it
 * and is said in the scene; once it is over, the one answer takes the result back to the scene.
 */
export function MiniGamePanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const offered = useGamesOffered()
  const [picked, setPicked] = useState<MiniGameDef | null>(null)
  const [underWay, setUnderWay] = useState(false)
  const [result, setResult] = useState<PlayResult | null>(null)

  // One game on offer is the game; the table it was opened at is kept if the offer then changes.
  const game = picked ?? (offered.length === 1 ? offered[0] : null)
  const Game = game ? gameComponent(game.id) : undefined

  // Nothing to play: the mod was switched off, or the scene moved on.
  const nothing = !game && offered.length === 0
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
      // The first move is the reader's turn taken: what the reply had left to say is dropped.
      started: () => {
        takeTurnForGame()
        setUnderWay(true)
      },
      finish: (ended) => setResult(ended)
    }),
    []
  )

  function leave(ended: PlayResult): void {
    fileResult(ended)
    onClose()
  }

  if (!host || nothing) return null

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
        aria-label={game ? game.name : 'Play a game'}
        variants={panelUnderTab}
      >
        <TitleTab>{game ? game.name : 'Play a game'}</TitleTab>

        <div className="vu-minigame-body">
          {game && Game ? (
            <Game play={play} />
          ) : (
            <ul className="vu-rows">
              {offered.map((entry) => (
                <li key={entry.id}>
                  <motion.button
                    type="button"
                    className="vu-row vu-minigame-pick"
                    {...gestures(false, rowLift, rowPress)}
                    onClick={() => setPicked(entry)}
                  >
                    <span className="vu-minigame-pickicon" aria-hidden="true">
                      {entry.icon}
                    </span>
                    <span className="vu-minigame-pickname">{entry.name}</span>
                    <span className="vu-minigame-pickblurb">{entry.blurb}</span>
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
          ) : underWay && game ? (
            <motion.button
              id="minigame-walk"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, lift, press)}
              onClick={() =>
                leave({
                  outcome: 'abandoned',
                  summary: `You walk away from the game of ${game.name} before it is over.`
                })
              }
            >
              Walk away
            </motion.button>
          ) : (
            <motion.button
              id="minigame-close"
              className="vu-btn vu-btn--quiet"
              type="button"
              {...gestures(false, lift, press)}
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
