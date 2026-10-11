import { useEffect, useRef, type JSX } from 'react'
import type { SceneSeatProps } from '../mods/hooks'
import { DiceIcon } from '../views/screenIcons'
import { keptAgreed, useTableStore } from './session'
import { useAtTurn, useGamesOffered, useSceneSpent, useTableOpen } from './table'

/**
 * The framework's seat on a scene's rail: there while a game is on offer in this scene, dim
 * while the reader cannot take a turn, and gone otherwise, the scene's closing included.
 */
export function MiniGameSeat({ Seat, visible, open }: SceneSeatProps): JSX.Element {
  const offered = useGamesOffered()
  const tableOpen = useTableOpen()
  // A game she agreed to opens by itself, once her answer has been read out.
  const agreed = useTableStore((s) => s.agreed)
  const atTurn = useAtTurn()
  // Read at the effect rather than depended on: the rail hands down a new one every render.
  const opener = useRef(open)
  opener.current = open
  useEffect(() => {
    if (!atTurn || !visible) return
    // In hand, or kept beside the save for exactly this point of the scene: a game reloaded
    // between her yes and the table.
    const due = agreed ?? keptAgreed()
    if (!due) return
    if (!agreed) useTableStore.getState().setAgreed(due)
    opener.current()
  }, [agreed, atTurn, visible])

  const spent = useSceneSpent()
  // Absent where there is nothing to offer; dim where there is, but not this moment.
  const state =
    !visible || spent || offered.length === 0 ? 'gone' : tableOpen ? 'shown' : 'dim'
  return (
    <Seat
      label={offered.length === 1 ? `Play ${offered[0].name}` : 'Play a game'}
      state={state}
      onClick={open}
    >
      <DiceIcon pips={5} />
    </Seat>
  )
}
