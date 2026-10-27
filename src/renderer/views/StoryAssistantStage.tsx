import { useEffect, type JSX } from 'react'
import { motion } from 'motion/react'
import { ASSISTANT_POPUP, STORY_ASSISTANT } from '@shared/storyAssistant'
import type { ScreenSlotProps } from '../mods/hooks'
import { submitAction, takeTurnFromReply } from '../stores/gameLoop'
import { useGameStore } from '../stores/gameStore'
import { useModOption } from '../stores/modsStore'
import {
  askAssistant,
  assistantNowOf,
  assistantSeatOf,
  cancelAssistant,
  cancelStaleAssistant,
  loadAssistantConfig,
  useAssistantNow,
  useAssistantStore
} from '../stores/storyAssistant'
import {
  dealt,
  dealtItem,
  gestures,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  spin
} from './motion'
import '../vu_styles/StoryAssistant.css'

/** The ways forward deal out one after another as the menu arrives. */
const CHOICES_DEALT = dealt(0.05)

/**
 * Story Assistant over the stage, on the reader's turn: its ways forward stood as a visual
 * novel's menu, one press each sending a way as his turn, and while there are none yet, one line
 * saying a read is on its way or why it failed. With the pop-up option on it reads the scene of
 * its own accord at every decision point; either way, a read asked for from the panel stands here
 * too.
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

  // Once a point, and only on a scene with lines on it: a failure waits for its Retry rather than
  // being sent again on its own. The store is read again as the effect runs, so an ask already
  // out for this point is never sent twice.
  const due =
    popup && sceneMode && !cinematic && transcript.length > 0 && seat === 'shown' &&
    !covered && !blocked && !read && !asking && !failed
  useEffect(() => {
    if (!due) return
    const now = assistantNowOf(useAssistantStore.getState(), useGameStore.getState())
    if (!now.read && !now.asking && !now.failed) void askAssistant('')
  }, [due])

  const ways = read?.reply.suggestions ?? []
  if (!shown || (ways.length === 0 && !asking && !failed)) return null

  const choose = (action: string): void => {
    if (takeTurnFromReply()) void submitAction(action)
  }

  return (
    <div className="vu-assistant-stage">
      {asking || failed ? (
        <motion.p
          key={`note-${transcript.length}`}
          className="vu-assistant-note vu-paper"
          variants={dealtItem}
          initial="hidden"
          animate="shown"
          role={failed ? 'alert' : 'status'}
        >
          {asking ? (
            <>
              <motion.span className="vu-ring" animate={spin} />
              Thinking it over…
            </>
          ) : (
            <>
              {failed?.message}
              <motion.button
                type="button"
                className="vu-pill vu-assistant-retry"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => failed && void askAssistant(failed.question)}
              >
                Retry
              </motion.button>
            </>
          )}
        </motion.p>
      ) : (
        <motion.ul
          key={`ways-${transcript.length}`}
          className="vu-assistant-menu"
          aria-label="Ways forward"
          variants={CHOICES_DEALT}
          initial="hidden"
          animate="shown"
        >
          {ways.map((way) => (
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
    </div>
  )
}
