import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import {
  ASSISTANT_ACTION_LIMIT,
  ASSISTANT_QUESTION_LIMIT,
  type StoryAssistantReply
} from '@shared/storyAssistant'
import { TextField } from '../components/TextField'
import { TitleTab } from '../components/TitleTab'
import { useModalShell } from '../components/useModalShell'
import type { ScenePanelProps, SceneSeatProps } from '../mods/hooks'
import { submitAction, takeTurnFromReply } from '../stores/gameLoop'
import { useGameStore } from '../stores/gameStore'
import { askAssistant, assistantSeatOf, keptRead } from '../stores/storyAssistant'
import {
  gestures,
  lift,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  spin,
  veilIn
} from './motion'
import '../vu_styles/StoryAssistant.css'

/** The assistant's mark: a speech bubble with a thought trailing in it. */
function AssistantIcon(): JSX.Element {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  )
}

/** The assistant's seat on the rail: there through a cast scene, and live on the reader's turn. */
export function StoryAssistantSeat({ Seat, visible, open }: SceneSeatProps): JSX.Element {
  const seat = useGameStore(assistantSeatOf)
  return (
    <Seat label="Story Assistant" state={visible ? seat : 'gone'} onClick={open}>
      <AssistantIcon />
    </Seat>
  )
}

/** Enter runs `go`, as it sends a turn in the scene; Shift+Enter still breaks a line. */
function enterRuns(go: () => void): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.stopPropagation()
    go()
  }
}

/**
 * What the assistant makes of the scene, and the ways forward it offers. Opened, it reads the
 * scene at once unless it already has where the scene stands; a way forward picked fills the
 * turn, which the player may change before it goes out as his turn in the scene.
 */
export function StoryAssistantPanel({ theme, onClose }: ScenePanelProps): JSX.Element | null {
  const seat = useGameStore(assistantSeatOf)
  const [kept] = useState(keptRead)
  const [question, setQuestion] = useState(kept?.question ?? '')
  const [read, setRead] = useState<StoryAssistantReply | null>(kept?.reply ?? null)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turn, setTurn] = useState('')

  // The call in flight, by its cancel group; only the newest one's answer is shown.
  const ticket = useRef<string | null>(null)
  const asks = useRef(0)
  const cancel = (): void => {
    if (ticket.current) void window.api.jobs.cancelGroup(ticket.current)
    ticket.current = null
  }
  useEffect(() => cancel, [])

  async function ask(words: string): Promise<void> {
    cancel()
    const group = `story-assistant:${++asks.current}`
    ticket.current = group
    setAsking(true)
    setError(null)
    try {
      const reply = await askAssistant(words, group)
      if (ticket.current !== group) return
      setRead(reply)
    } catch (thrown) {
      if (ticket.current !== group) return
      setError(thrown instanceof Error ? thrown.message : String(thrown))
    } finally {
      if (ticket.current === group) {
        ticket.current = null
        setAsking(false)
      }
    }
  }

  // Opened with nothing kept for this point of the scene, it reads the scene straight away.
  useEffect(() => {
    if (!kept) void ask('')
  }, [])

  const askDead = asking || seat !== 'shown'
  const sendDead = !turn.trim() || seat !== 'shown'
  const askNow = (): void => {
    if (!askDead) void ask(question)
  }
  const send = (): void => {
    if (sendDead) return
    if (!takeTurnFromReply()) {
      setError('The scene cannot take a turn right now.')
      return
    }
    void submitAction(turn.trim())
    onClose()
  }

  const { host, overlayProps } = useModalShell(onClose)
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
        id="story-assistant-panel"
        className="vu-sheet vu-assistant vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Story Assistant"
        aria-busy={asking}
        variants={panelUnderTab}
      >
        <TitleTab>Story Assistant</TitleTab>

        <div className="vu-assistant-body">
          <div onKeyDown={enterRuns(askNow)}>
            <TextField
              id="story-assistant-question"
              label="Ask about the scene"
              hint="Leave it blank for a read of the scene as a whole."
              value={question}
              onChange={setQuestion}
              maxLength={ASSISTANT_QUESTION_LIMIT}
            />
          </div>

          {asking ? (
            <p className="vu-assistant-state" role="status">
              <motion.span className="vu-ring" animate={spin} />
              Reading the scene…
            </p>
          ) : error ? (
            <p className="vu-assistant-state" role="alert">
              {error}
            </p>
          ) : read?.commentary ? (
            <p className="vu-assistant-read">{read.commentary}</p>
          ) : null}

          {!asking && read && read.suggestions.length > 0 && (
            <ul className="vu-rows vu-assistant-ways" aria-label="Ways forward">
              {read.suggestions.map((way) => (
                <li key={way.action}>
                  <motion.button
                    type="button"
                    className="vu-row vu-assistant-way"
                    {...gestures(false, rowLift, rowPress)}
                    onClick={() => setTurn(way.action)}
                  >
                    <span className="vu-assistant-wayname">{way.label}</span>
                    <span className="vu-assistant-wayaction">{way.action}</span>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}

          <div onKeyDown={enterRuns(send)}>
            <TextField
              id="story-assistant-turn"
              label="Your turn"
              hint="Pick a way forward or write your own, and change it however you like."
              value={turn}
              onChange={setTurn}
              maxLength={ASSISTANT_ACTION_LIMIT}
              multiline
              rows={2}
            />
          </div>
        </div>

        <div className="vu-foot">
          <motion.button
            id="story-assistant-back"
            className="vu-btn vu-btn--quiet"
            type="button"
            {...gestures(false, quietLift, quietPress)}
            onClick={onClose}
          >
            Back
          </motion.button>
          <motion.button
            id="story-assistant-ask"
            className="vu-btn vu-btn--quiet"
            type="button"
            disabled={askDead}
            {...gestures(askDead, quietLift, quietPress)}
            onClick={askNow}
          >
            {question.trim() ? 'Ask' : 'Read again'}
          </motion.button>
          <motion.button
            id="story-assistant-send"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            disabled={sendDead}
            {...gestures(sendDead, lift, press)}
            onClick={send}
          >
            Send
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    host
  )
}
