import { useEffect, type JSX } from 'react'
import { motion } from 'motion/react'
import { ASSISTANT_POPUP, STORY_ASSISTANT } from '@shared/storyAssistant'
import type { ScreenSlotProps } from '../mods/hooks'
import { submitAction, takeTurnFromReply } from '../stores/gameLoop'
import { useGameStore } from '../stores/gameStore'
import { useModOption } from '../stores/modsStore'
import {
  askAssistant,
  assistantSeatOf,
  cancelAssistant,
  cancelStaleAssistant,
  loadAssistantConfig,
  useAssistantNow
} from '../stores/storyAssistant'
import {
  bubbleIn,
  dealt,
  dealtItem,
  gestures,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  spin
} from './motion'
import { AssistantIcon } from './StoryAssistantPanel'
import '../vu_styles/StoryAssistant.css'

/** The ways forward deal out as the bubble lands. */
const CHOICES_DEALT = dealt(0.12)

/**
 * Story Assistant over the stage, on the reader's turn: what it makes of the scene in a bubble
 * above the dialogue box, its mark speaking from the bubble's tail, and the ways forward stood
 * over it as a menu, one press each sending a way as his turn. With the pop-up option on it reads
 * the scene of its own accord at every decision point; either way, a read asked for from the
 * panel stands here too.
 */
export function StoryAssistantStage({
  sceneMode,
  cinematic,
  covered,
  uiHidden,
  blocked,
  quiz
}: ScreenSlotProps['stageLayer']): JSX.Element | null {
  const seat = useGameStore(assistantSeatOf)
  const transcript = useGameStore((s) => s.currentSceneTranscript)
  const marks = useGameStore((s) => s.sceneSummaries)
  const popup = useModOption(STORY_ASSISTANT, ASSISTANT_POPUP)
  const { read, asking, failed } = useAssistantNow()
  const shown = sceneMode && !cinematic && !covered && !uiHidden && !blocked && !quiz && seat === 'shown'

  // The player's prompt is read as a game is entered, before anything is asked of it. A read under
  // way the scene has moved past is cancelled; leaving the game cancels any.
  useEffect(() => {
    void loadAssistantConfig()
    return cancelAssistant
  }, [])
  useEffect(() => cancelStaleAssistant(), [transcript, marks])

  // Once a point: a failure waits for its Retry rather than being sent again on its own.
  const due = popup && seat === 'shown' && !covered && !blocked && !read && !asking && !failed
  useEffect(() => {
    if (due) void askAssistant('')
  }, [due])

  if (!shown || (!read && !asking && !failed)) return null

  const choose = (action: string): void => {
    if (takeTurnFromReply()) void submitAction(action)
  }

  return (
    <div className="vu-assistant-stage">
      {read && read.reply.suggestions.length > 0 && (
        <motion.ul
          key={`ways-${transcript.length}`}
          className="vu-assistant-menu"
          aria-label="Ways forward"
          variants={CHOICES_DEALT}
          initial="hidden"
          animate="shown"
        >
          {read.reply.suggestions.map((way) => (
            <motion.li key={way.action} variants={dealtItem}>
              <motion.button
                type="button"
                className="vu-assistant-choice vu-paper"
                {...gestures(false, rowLift, rowPress)}
                onClick={() => choose(way.action)}
              >
                <span className="vu-assistant-choicename">{way.label}</span>
                <span className="vu-assistant-choiceaction">{way.action}</span>
              </motion.button>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {(asking || failed || read?.reply.commentary) && (
      <motion.div
        key={`bubble-${transcript.length}`}
        className="vu-assistant-bubble vu-paper"
        variants={bubbleIn}
        initial="hidden"
        animate="shown"
        role={failed ? 'alert' : 'status'}
      >
        <span className="vu-assistant-speaker" aria-hidden="true">
          <AssistantIcon />
        </span>
        {asking ? (
          <p className="vu-assistant-thinking">
            <motion.span className="vu-ring" animate={spin} />
            Thinking it over…
          </p>
        ) : failed ? (
          <p className="vu-assistant-thinking">
            {failed.message}
            <motion.button
              type="button"
              className="vu-pill vu-assistant-retry"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => void askAssistant(failed.question)}
            >
              Retry
            </motion.button>
          </p>
        ) : (
          <p className="vu-assistant-says">{read?.reply.commentary}</p>
        )}
      </motion.div>
      )}
    </div>
  )
}
