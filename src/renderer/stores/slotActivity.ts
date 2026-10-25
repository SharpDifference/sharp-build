import { useGameStore } from './gameStore'
import { submitAction } from './gameLoop'
import { writeAutosave } from './loop/saves'
import { currentRun, runStale } from './loop/state'

/** Settles the pending activity and sends its closing turn. No points move here. */
export async function finishSlotActivity(owner: string, id: string, completed: boolean, result: string): Promise<boolean> {
  const game = useGameStore.getState()
  const activity = game.sceneActivity
  if (!activity || activity.owner !== owner || activity.id !== id || activity.status !== 'pending') return false
  useGameStore.setState({ sceneActivity: { ...activity, status: completed ? 'completed' : 'abandoned', result } })
  await resumeSlotActivity()
  return true
}

/** Sends a settled activity's closing turn, once it is saved: on a reload too, never replaying its play. */
export async function resumeSlotActivity(): Promise<void> {
  const game = useGameStore.getState()
  const activity = game.sceneActivity
  if (!activity || activity.status === 'pending' || activity.closed || game.busy || game.turnError || game.sceneEnding || !game.awaitingInput) return
  const run = currentRun()
  // Lock during persistence, before a second effect/callback can submit this closing.
  useGameStore.setState({ busy: true })
  await writeAutosave(game.captureScene())
  if (runStale(run)) return
  useGameStore.setState({ busy: false })
  await submitAction(`The activity is over. ${activity.result ?? 'The session ended without completion.'}`)
}
