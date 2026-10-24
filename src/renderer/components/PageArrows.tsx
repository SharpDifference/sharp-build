import { useRef, type JSX, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import { motion } from 'motion/react'
import { gestures, rowLift, rowPress } from '../views/motion'
import { ChevronIcon, PlusIcon } from '../views/screenIcons'
import { accumulateNotch, wheelNotches, type WheelTravel } from '../views/wheel'
import '../vu_styles/PageArrows.css'

/** A page index on the ring of pages: one past the last is the first, one before the first the last. */
export function wrapPage(to: number, pageCount: number): number {
  return ((to % pageCount) + pageCount) % pageCount
}

export interface PageArrowsProps {
  /** The frame's own id, where its caller is looked up by one. */
  id?: string
  /** What the controls are named from: `-prev`, `-next`, `-add` and `-count` after it. */
  idPrefix: string
  page: number
  pageCount: number
  onPage: (page: number) => void
  /** Something is running under the page, and the wheel turns nothing. */
  busy?: boolean
  /**
   * Whether the pages are a ring. Off, turning stops at either end, where that arrow is dead, and
   * a lone page stands with no arrows at all, their seats kept.
   */
  ring?: boolean
  /** Off the ring, whether the run goes on past its last page: turning past it opens the next. */
  open?: boolean
  /** Where the page on screen stands in the run, said under it. */
  count?: string
  /** Opens a page past the last; where given, its plus stands in the next arrow's seat on the last page. */
  onAdd?: () => void
  /** The plus is dead: the page it would open could not be used. */
  addDead?: boolean
  /** The page on screen, standing between the arrows. */
  children: ReactNode
}

/**
 * A page between the two tall arrows that turn it, with where it stands in the run said under
 * it. The wheel over any of it turns the page a notch at a time. The pages are a ring, where
 * turning past either end lands on the other, or a run that stops at its first page and at its
 * last unless it is open past it; the plus that opens a page past the last is the caller's to
 * offer.
 */
export function PageArrows({
  id,
  idPrefix,
  page,
  pageCount,
  onPage,
  busy = false,
  ring = true,
  open = false,
  count,
  onAdd,
  addDead = false,
  children
}: PageArrowsProps): JSX.Element {
  const travel = useRef<WheelTravel>({ sum: 0, at: 0 })

  /** Turns to a page: round the ring, or no further than the ends of a run it has. */
  const turn = (to: number): void => {
    const next = ring
      ? wrapPage(to, pageCount)
      : Math.min(Math.max(to, 0), open ? page + 1 : pageCount - 1)
    if (next !== page) onPage(next)
  }

  // A run of one page has nowhere to turn, so it stands no arrows.
  const arrows = ring || open || pageCount > 1
  const atFirst = !ring && page === 0
  const atLast = !ring && !open && page === pageCount - 1
  const adding = onAdd !== undefined && page === pageCount - 1

  /**
   * A notch down turns forward and a notch up turns back, once the notches add up to one, and
   * never more than a page an event, however many notches arrive in it.
   */
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    if (busy) return
    const step = accumulateNotch(travel.current, wheelNotches(event.nativeEvent))
    if (step !== 0) turn(page + Math.sign(step))
  }

  return (
    <div id={id} className="vu-pages" onWheel={onWheel}>
      <div className="vu-pages-row">
        {arrows ? (
          <motion.button
            id={`${idPrefix}-prev`}
            className="vu-pages-arrow"
            type="button"
            aria-label="Previous page"
            disabled={atFirst}
            {...gestures(atFirst, rowLift, rowPress)}
            onClick={() => turn(page - 1)}
          >
            <ChevronIcon back />
          </motion.button>
        ) : (
          <span className="vu-pages-seat" />
        )}

        {children}

        {adding ? (
          // Keyed apart from the arrow whose seat it takes, so neither inherits the other's hover.
          <motion.button
            key="add"
            id={`${idPrefix}-add`}
            className="vu-pages-arrow"
            type="button"
            aria-label="New page"
            disabled={addDead}
            {...gestures(addDead, rowLift, rowPress)}
            onClick={onAdd}
          >
            <PlusIcon size={20} />
          </motion.button>
        ) : arrows ? (
          <motion.button
            key="next"
            id={`${idPrefix}-next`}
            className="vu-pages-arrow"
            type="button"
            aria-label="Next page"
            disabled={atLast}
            {...gestures(atLast, rowLift, rowPress)}
            onClick={() => turn(page + 1)}
          >
            <ChevronIcon />
          </motion.button>
        ) : (
          <span className="vu-pages-seat" />
        )}
      </div>

      {count !== undefined && (
        <span id={`${idPrefix}-count`} className="vu-pages-count">
          {count}
        </span>
      )}
    </div>
  )
}
