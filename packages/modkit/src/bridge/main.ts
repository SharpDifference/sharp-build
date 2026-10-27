/**
 * The bridge for the main process: what core's `src/main` offers a mod, re-exported here and
 * nowhere else in the kit (see `shared.ts`).
 */
export { registerComfyLaunchEnvironment } from '../../../../src/main/services/comfyLaunchEnvironment'
export type { ComfyLaunchContext } from '../../../../src/main/services/comfyLaunchEnvironment'
