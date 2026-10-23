import { useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useModalShell } from '../components/useModalShell'
import { PageArrows } from '../components/PageArrows'
import { TitleTab } from '../components/TitleTab'
import { WardrobeColumn, type WardrobeColumnProps } from '../components/WardrobeColumn'
import { customOutfitSlotAt, customSlotNumber } from '@shared/outfits'
import type { CustomOutfitSlot } from '@shared/types'
import { OUTFIT_PAGE_SLOTS, useSlotPages } from './customPages'
import { dealt, gestures, lift, panelUnderTab, press, slideInQuick, veilIn } from './motion'
import '../vu_styles/EditCharacter.css'
import '../vu_styles/CustomOutfits.css'

/** A page's columns dealing in with the page, quick and close together. */
const PAGE_DEAL = dealt(0, 0.02)

export interface CustomOutfitsModalProps {
  /** Drawn by the screen that opened this — a portal inherits neither. */
  theme: 'day' | 'night'
  /** The column the editor builds for one slot. */
  columnOf: (slot: CustomOutfitSlot) => WardrobeColumnProps
  /** The slots holding a record or an image, in slot order. */
  taken: readonly CustomOutfitSlot[]
  /** A new page's plus is dead: its empty slots could not be rendered now. */
  addDead: boolean
  onClose: () => void
}

/**
 * The player-authored wardrobes five abreast, at the size the game will show a sprite, a page at
 * a time between the arrows. Every control on them is the Edit modal's, which keeps its own
 * confirms and tag modals.
 */
export function CustomOutfitsModal({
  theme,
  columnOf,
  taken,
  addDead,
  onClose
}: CustomOutfitsModalProps): JSX.Element | null {
  const { host, overlayProps, topmost } = useModalShell(onClose)
  // The slot last copied from while the panel stands, whose pill says so.
  const [copied, setCopied] = useState<CustomOutfitSlot | null>(null)
  const pages = useSlotPages(taken.map(customSlotNumber), OUTFIT_PAGE_SLOTS, topmost)
  if (!host) return null

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
        id="custom-outfits"
        className="vu-sheet--wide vu-customs vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Custom outfits"
        variants={panelUnderTab}
      >
        <TitleTab>Custom outfits</TitleTab>

        <PageArrows
          idPrefix="custom-outfits-page"
          page={pages.page}
          pageCount={pages.pageCount}
          onPage={pages.onPage}
          ring={false}
          onAdd={pages.onAdd}
          addDead={addDead}
        >
          {/* The page the panel opens on stands as it is; a turn re-deals the next. */}
          <motion.div
            key={pages.page}
            className="vu-customs-grid"
            variants={PAGE_DEAL}
            initial={pages.turned ? 'hidden' : false}
            animate="shown"
          >
            {pages.numbers.map((number) => {
              const slot = customOutfitSlotAt(number)
              const column = columnOf(slot)
              const onCopy = column.onCopy
              return (
                <motion.div key={slot} className="vu-customs-cell" variants={slideInQuick}>
                  <WardrobeColumn
                    {...column}
                    onCopy={
                      onCopy &&
                      (() => {
                        onCopy()
                        setCopied(slot)
                      })
                    }
                    copied={copied === slot}
                  />
                </motion.div>
              )
            })}
          </motion.div>
        </PageArrows>

        <div className="vu-foot">
          <motion.button
            id="custom-outfits-close"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={onClose}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
