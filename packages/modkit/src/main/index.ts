/** `@vx/modkit/main`: what a mod's main-process code may import. */
export { backupPart, characterTransferPart, modDataPath, registerComfyLaunchEnvironment } from '../bridge/main'
export type {
  BackupPart,
  BackupPartContext,
  BackupPartExport,
  BackupPartLegacy,
  BackupPartRestore,
  CharacterTransferPart,
  ComfyLaunchContext
} from '../bridge/main'
