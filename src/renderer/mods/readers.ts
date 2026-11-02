import { useMemo } from 'react'
import type { AppError } from '@shared/types'
import { busGain, volumesOf } from '@shared/audio'
import { BUILD, modNames, modsOn } from '@shared/mods'
import { useModsStore } from '../stores/modsStore'
import { useGameStore } from '../stores/gameStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'

/**
 * The player has Less NSFW text on: the game's own writing is toned down, and a mod's should be.
 * True until the settings have been read, so nothing explicit is written before they are known.
 */
export function lessNsfwText(): boolean {
  return useSettingsStore.getState().settings?.lessNsfwText !== false
}

/** {@link lessNsfwText} for a component, which renders again when the player changes it. */
export function useLessNsfwText(): boolean {
  return useSettingsStore((state) => state.settings?.lessNsfwText !== false)
}

/** The gain a mod's own sound effects play at: the player's effects volume, as the game's mix applies it. */
export function useSfxGain(): number {
  return useSettingsStore((state) => busGain(volumesOf(state.settings?.volumes).sfx))
}

/** The build being played, its name and version, as the main menu and the log name it. */
export function buildLabel(): string {
  return `${BUILD.name} ${BUILD.version}`
}

/** The mods that are on, each with its version, as the game's log lists them: for a bug report. */
export function modsOnLine(): string {
  return modNames(modsOn(useModsStore.getState().switches))
}

/** Raises the game's error modal over whatever is showing, as the game does for its own failures. */
export function showError(error: AppError): void {
  useUiStore.getState().showError(error)
}

/** The playthrough being played, if any, and the reader's first name. */
export function gameFacts(): { playthroughId: string | null; readerName: string } {
  const game = useGameStore.getState()
  return { playthroughId: game.playthroughId, readerName: game.playerFirstName }
}

/** {@link gameFacts} for a component: it renders again when either changes. */
export function useGameFacts(): { playthroughId: string | null; readerName: string } {
  const playthroughId = useGameStore((state) => state.playthroughId)
  const readerName = useGameStore((state) => state.playerFirstName)
  return useMemo(() => ({ playthroughId, readerName }), [playthroughId, readerName])
}

/** The cast-scene persona the player has stored, or undefined until settings are read or when none is stored. */
export function useScenePersona(): string | undefined {
  return useSettingsStore((state) => state.settings?.scenePersona)
}
