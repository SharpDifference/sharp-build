import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  breatheDecor,
  doorway,
  doubled,
  fadeIn,
  gestures,
  lift,
  press,
  quietLift,
  quietPress,
  rippleChase,
  rippleLead
} from './motion'
import { BackIcon, ChevronIcon } from './screenIcons'

/**
 * The screen's opening, built once: a `Variants` object made during render is a new identity
 * every time, which restarts the ripple's variant tree and its completion never fires
 * (`motion.ts`, the ripple).
 */
const BACKDROP_IN = fadeIn(0, 0.5)
const HEADER_IN = fadeIn(0.1)
const FOOT_IN = fadeIn(0.5)

/** The screen's Next: whether it is live, what it does, and what it reads where not Next. */
export interface FrameNext {
  dead: boolean
  onPress: () => void
  label?: string
}

export interface NewGameFrameProps {
  theme: 'day' | 'night'
  /** Whether the screen answers nothing: a crossing over it, or a leave being carried out. */
  inert: boolean
  /** The circle's answer: back to the main menu, however the screen asks. */
  onLeave: () => void
  leaveDead?: boolean
  title: string
  /** Read beside the title in the bookkeeping voice. */
  reading?: ReactNode
  /** The screen's own controls, at the far end of the title row, or of the hint's where there is one. */
  controls?: ReactNode
  /** What the screen asks of the player, under the header row. */
  hint?: string
  /** Absent where there is no screen to go back to. */
  back?: { dead: boolean; onPress: () => void }
  /** The screen's own utilities, standing in the foot after Back. */
  tools?: ReactNode
  /** Absent where the screen has no calls to skip. */
  skip?: { dead: boolean; onPress: () => void }
  /** Absent where the screen offers no way forward of its own. */
  next?: FrameNext
  /** Whether a modal stands over the screen, which no hover ending is reported through. */
  covered: boolean
  children?: ReactNode
}

/**
 * New Game's frame: the corner archway, the header, and the foot whose doubled Next opens the
 * archway into a doorway under the pointer, leaving a wave across the screen. Every screen of the
 * New Game flow stands in it.
 */
export function NewGameFrame({
  theme,
  inert,
  onLeave,
  leaveDead = false,
  title,
  reading,
  controls,
  hint,
  back,
  tools,
  skip,
  next,
  covered,
  children
}: NewGameFrameProps): JSX.Element {
  // A player who asked their OS for less motion gets none of the flourish below: a positional
  // target is applied *instantly* under it, so an unguarded opening would arrive on the
  // next frame and fire a ripple nobody asked for.
  const still = useReducedMotion()
  // Whether the pointer is on the primary, and whether the ripple its departure launched is
  // still running; the second is a ref, written from an animation rather than from a render.
  const [hovering, setHovering] = useState(false)
  const [rippling, setRippling] = useState(false)
  const rippleBusy = useRef(false)

  const nextDead = !next || next.dead
  const armed = hovering && !nextDead && !covered && !inert && !still

  useEffect(() => {
    if (nextDead || covered || inert) setHovering(false)
  }, [nextDead, covered, inert])

  // The wave leaves the moment the pointer lands, not when the doorway has finished opening:
  // waiting on the arrival put a beat of nothing between the two. They run together instead,
  // and the doorway — far the faster of them — is over the spot the wave is born before it
  // has travelled anywhere. A ripple already running swallows the next arming rather than
  // queueing it: what launches one is a hover nothing is answering yet.
  useEffect(() => {
    if (!armed || rippleBusy.current) return
    rippleBusy.current = true
    setRippling(true)
  }, [armed])

  return (
    // The crossing takes the pointer from its first frame but not the keyboard, and a screen
    // behind a curtain must answer neither.
    <div className="vu-newgame" data-theme={theme} inert={inert}>
      {/* The corner archway, and the wave its departure leaves. Written before everything
          the player reads, so tree order keeps the content in front of it. */}
      <motion.div
        className="vu-newgame-backdrop"
        variants={BACKDROP_IN}
        initial="hidden"
        animate="shown"
      >
        {rippling && (
          <>
            <motion.div
              className="vu-newgame-decor vu-newgame-ripple"
              variants={rippleLead}
              initial="rest"
              animate="spread"
            >
              <div className="vu-newgame-decor-arch" />
            </motion.div>
            <motion.div
              className="vu-newgame-decor vu-newgame-ripple"
              variants={rippleChase}
              initial="rest"
              animate="spread"
              // The ground has covered the stage, so there is nothing left to see: the pair
              // goes, and the next opening may launch another.
              onAnimationComplete={(label) => {
                if (label !== 'spread') return
                rippleBusy.current = false
                setRippling(false)
              }}
            >
              <div className="vu-newgame-decor-arch vu-newgame-decor-arch--ground" />
            </motion.div>
          </>
        )}
        {/* Last, so it stands over the wave it is hiding the birth of. The box breathes and
            the arch inside it answers the pointer: both are `scale`, and on one element the
            last writer would win. */}
        <motion.div className="vu-newgame-decor" animate={breatheDecor}>
          <motion.div
            className="vu-newgame-decor-arch"
            variants={doorway}
            initial={false}
            animate={armed ? 'open' : 'rest'}
          />
        </motion.div>
      </motion.div>

      <motion.header
        className="vu-newgame-header"
        variants={HEADER_IN}
        initial="hidden"
        animate="shown"
      >
        <div className="vu-newgame-head-row">
          <motion.button
            id="new-game-leave"
            className="vu-circle vu-newgame-back"
            aria-label="Main Menu"
            disabled={leaveDead}
            {...gestures(leaveDead, quietLift, quietPress)}
            onClick={onLeave}
          >
            <BackIcon />
          </motion.button>

          <div className="vu-title">
            <h1 className="vu-title-text">{title}</h1>
          </div>
          {reading}
          {!hint && controls}
        </div>
        {/* Under a hint, the screen's controls stand at the end of its row, the title row
            being the step reading's. */}
        {hint && (
          <div className="vu-newgame-hint-row">
            <p className="vu-newgame-hint">{hint}</p>
            {controls}
          </div>
        )}
      </motion.header>

      {children}

      <motion.footer className="vu-newgame-foot" variants={FOOT_IN} initial="hidden" animate="shown">
        {(back || tools) && (
          <div className="vu-newgame-foot-start">
            {back && (
              <motion.button
                id="new-game-back"
                className="vu-btn vu-btn--outline vu-btn--panel vu-paper"
                {...gestures(back.dead, lift, press)}
                disabled={back.dead}
                onClick={back.onPress}
              >
                Back
              </motion.button>
            )}
            {tools && <div className="vu-newgame-tools">{tools}</div>}
          </div>
        )}
        {skip && (
          <motion.button
            id="new-game-skip"
            className="vu-btn vu-btn--outline vu-btn--panel vu-paper vu-newgame-skip"
            {...gestures(skip.dead, lift, press)}
            disabled={skip.dead}
            onClick={skip.onPress}
          >
            Skip generation
          </motion.button>
        )}
        {next && (
          // The wrapper wears the size; the button inside keeps its own lift and press.
          <motion.div className="vu-newgame-start" style={doubled}>
            <motion.button
              id="new-game-next"
              className="vu-btn vu-btn--primary vu-btn--panel vu-paper"
              {...gestures(next.dead, lift, press)}
              disabled={next.dead}
              onHoverStart={() => setHovering(true)}
              onHoverEnd={() => setHovering(false)}
              onClick={next.onPress}
            >
              {next.label ?? 'Next'}
              {/* The mark says where the button goes, which is as true of one that cannot go
                  there yet — so it stays whether or not the button is live. */}
              <ChevronIcon />
            </motion.button>
          </motion.div>
        )}
      </motion.footer>
    </div>
  )
}
