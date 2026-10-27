import { assignEchoes, settleEchoMemories } from '../../shared/echo'
import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type ScreenSlotProps } from '../mods/hooks'
import { useGameStore } from '../stores/gameStore'
import { ensureEchoes } from '../stores/echoAssignments'

// Registering gameplay hooks must not initialize screen stores or their Electron listeners.
const screens = () => import('../views/EchoPanel')
const LazyAura = lazy(() => screens().then(module => ({ default: module.EchoAura })))
const LazyGallery = lazy(() => screens().then(module => ({ default: module.EchoGallerySection })))

function EchoPortrait(props: ScreenSlotProps['portraitOverlay']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyAura, props))
}

function EchoPhotos(props: ScreenSlotProps['photosPageSection']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyGallery, props))
}

registerHooks('echo', {
  portraitOverlay: EchoPortrait,
  photosPageSection: EchoPhotos,
  gameEntered: ensureEchoes,
  projectSlotMemories: ({ before }, charInfo) => {
    if (!before.playthroughId || before.replaying || before.createdScene) return charInfo
    const echoes = assignEchoes(before.exEcho,before.playthroughId,before.characters,`${before.playerFirstName} ${before.playerLastName}`,before.bio)
    return settleEchoMemories(echoes,before.charInfo,charInfo,before.date)
  },
  slotSettled: ({ before }) => {
    ensureEchoes()
    const g = useGameStore.getState()
    if (g.replaying || g.createdScene || g.playthroughId !== before.playthroughId || g.loads !== before.loads) return
    useGameStore.setState({ charInfo: settleEchoMemories(g.exEcho,before.charInfo,g.charInfo,before.date) })
  }
})
