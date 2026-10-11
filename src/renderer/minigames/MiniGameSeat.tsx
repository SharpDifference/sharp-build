import { useEffect, useRef, type JSX } from 'react'
import type { SceneSeatProps } from '../mods/hooks'
import { DiceIcon } from '../views/screenIcons'
import { useTableStore } from './session'
import { useAtTurn, useGamesOffered, useTableOpen } from './table'

/**
 * The framework's seat on a scene's rail: there while a game is on offer in this scene, dim
 * while it is not the reader's turn, and gone otherwise.
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
    if (agreed && atTurn && visible) opener.current()
  }, [agreed, atTurn, visible])

  const state = !visible || offered.length === 0 ? 'gone' : tableOpen ? 'shown' : 'dim'
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
