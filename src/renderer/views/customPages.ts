import { useState } from 'react'
import { typingIn, useWindowKeydown } from '../components/useWindowKeydown'

/**
 * The pages a character's own wardrobes and CG pairs stand on: each slot on the page its number
 * falls on, as many pages as her highest slot in use needs, and the page a plus opened past them.
 */

/** How many custom wardrobes one page of the Custom outfits panel stands abreast. */
export const OUTFIT_PAGE_SLOTS = 5

/** How many custom CG pairs one page of the Custom CG panel and of the CG picker stands abreast. */
export const CG_PAGE_SLOTS = 4

/** The slot numbers one page stands, counted from one. */
export function pageSlotNumbers(page: number, size: number): number[] {
  return Array.from({ length: size }, (_, index) => page * size + index + 1)
}

/** How many pages her highest slot in use needs, at least one. */
export function slotPageCount(lastTaken: number, size: number): number {
  return Math.max(1, Math.ceil(lastTaken / size))
}

/** One custom panel's pages, as its arrows, its plus and its grid read them. */
export interface SlotPages {
  page: number
  pageCount: number
  /** The slot numbers on the page on screen. */
  numbers: number[]
  /** Whether the page has been turned since the panel opened, which is what re-deals it. */
  turned: boolean
  onPage: (page: number) => void
  /** Opens a page past the last, offered only on a last page whose every slot is taken. */
  onAdd?: () => void
}

/**
 * The page on screen and how many there are: enough for the highest slot in use, and the page a
 * plus opened, which stands until it is left with nothing in it. The arrow keys turn it as the
 * arrows do, no further than either end, while nothing stands over the panel.
 */
export function useSlotPages(
  taken: readonly number[],
  size: number,
  topmost: () => boolean
): SlotPages {
  const [page, setPage] = useState(0)
  const [turned, setTurned] = useState(false)
  const pageCount = Math.max(slotPageCount(Math.max(0, ...taken), size), page + 1)
  const numbers = pageSlotNumbers(page, size)
  const held = new Set(taken)
  const full = numbers.every((number) => held.has(number))

  const onPage = (to: number): void => {
    setPage(to)
    setTurned(true)
  }

  useWindowKeydown((event) => {
    if (!topmost() || typingIn(event)) return
    if (event.key === 'ArrowLeft' && page > 0) onPage(page - 1)
    else if (event.key === 'ArrowRight' && page < pageCount - 1) onPage(page + 1)
  })

  return {
    page,
    pageCount,
    numbers,
    turned,
    onPage,
    onAdd: full && page === pageCount - 1 ? () => onPage(page + 1) : undefined
  }
}
