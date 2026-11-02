import type { JSX, ReactNode } from 'react'
import { motion } from 'motion/react'
import { MaskedFace } from '../components/Spoiler'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { dealt, fadeIn, gestures, rowLift, rowPress, slideInQuick } from './motion'
import '../vu_styles/Bunnyboard.css'
import '../vu_styles/NewGameEntries.css'

/** The body arriving under the header, built once. */
const BODY_IN = fadeIn(0.2)

/** Each section's rows dealing themselves in, on the Lorebook tab's clock. */
const LIST_DEAL = dealt(0, 0.02)

/**
 * The panel the Occasions and Classes screens draw: a list column, laid out as the Lorebook tab
 * lays its own, beside a pane holding what is open in it, the pane's fields one form.
 */
export function EntriesPanel({
  side,
  pane,
  paneKey
}: {
  side: ReactNode
  pane: ReactNode
  /** What is open in the pane, so another opens at its top. */
  paneKey?: string
}): JSX.Element {
  return (
    <motion.div className="vu-entries" variants={BODY_IN} initial="hidden" animate="shown">
      {/* The paper face; the page inside it does the clipping, a paper element clipping its own
          shadow. */}
      <div className="vu-newgame-panel vu-paper">
        <div className="vu-newgame-page">
          <div className="vu-bb-side vu-entries-side">
            <div className="vu-entries-box">
              <div className="vu-bb-scroll">{side}</div>
              <div className="vu-scroll-fade" />
            </div>
          </div>
          <form className="vu-entries-pane" onSubmit={(event) => event.preventDefault()}>
            <div className="vu-entries-box">
              <div key={paneKey} className="vu-entries-scroll">
                {pane}
              </div>
              <div className="vu-scroll-fade" />
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  )
}

/** One section of a pane that holds several: its heading, the lines about it, then its fields. */
export function PaneSection({
  title,
  lines = [],
  children
}: {
  title: string
  lines?: readonly ReactNode[]
  children: ReactNode
}): JSX.Element {
  return (
    <section className="vu-entries-section" aria-label={title}>
      <h3 className="vu-entries-section-head">{title}</h3>
      {lines.map((line, index) => (
        <p key={index} className="vu-entries-text">
          {line}
        </p>
      ))}
      {children}
    </section>
  )
}

/** One section of the list column: its heading in the bookkeeping voice, then its rows. */
export function EntrySection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <>
      <div className="vu-bb-section">{title}</div>
      <motion.ul className="vu-rows" variants={LIST_DEAL} initial="hidden" animate="shown">
        {children}
      </motion.ul>
    </>
  )
}

export interface EntryRowProps {
  id: string
  title: string
  /** A second line under the title. */
  sub?: string
  /** What the row holds, in the mono voice at its end. */
  reading?: string
  /** Something in it is started and not finished. */
  warn?: boolean
  /** The row is the game's own and only read here. */
  muted?: boolean
  /** Whose face opens the row, where it is a girl's. */
  faceOf?: string
  /** Her face is behind setup's mask. */
  masked?: boolean
  /** A label worn on the row's corner, naming what it is. */
  sticker?: string
  on: boolean
  onOpen: () => void
  /** Data attributes the row carries for whoever reads it off the page. */
  data?: Record<`data-${string}`, string>
}

/**
 * One row of the list column, the one open in the pane outlined in the accent, and any sticker
 * a sibling of the button riding its corner.
 */
export function EntryRow({
  id,
  title,
  sub,
  reading,
  warn = false,
  muted = false,
  faceOf,
  masked = false,
  sticker,
  on,
  onOpen,
  data
}: EntryRowProps): JSX.Element {
  const version = useSpriteVersion(faceOf)
  return (
    <motion.li className="vu-entries-item" variants={slideInQuick}>
      <motion.button
        id={id}
        className={`vu-row vu-entries-row${on ? ' vu-entries-row--on' : ''}${muted ? ' vu-entries-row--muted' : ''}`}
        type="button"
        aria-pressed={on}
        {...data}
        {...gestures(false, rowLift, rowPress)}
        onClick={onOpen}
      >
        {faceOf !== undefined && (
          <span className="vu-arch vu-entries-face">
            {masked ? (
              <MaskedFace />
            ) : (
              <span className="vu-crop">
                <img className="vu-crop-img" src={profileUrl(faceOf, version)} alt="" />
              </span>
            )}
          </span>
        )}
        <span className="vu-entries-words">
          <span className="vu-bb-name vu-entries-title">{title}</span>
          {sub && <span className="vu-bb-preview">{sub}</span>}
        </span>
        {warn && <span className="vu-form-dot vu-form-dot--warn" />}
        {reading && <span className="vu-entries-reading">{reading}</span>}
      </motion.button>
      {sticker && <span className="vu-sticker vu-entries-row-sticker">{sticker}</span>}
    </motion.li>
  )
}
