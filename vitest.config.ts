import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * The save-integrity test suite. Node environment only — no test touches the DOM or
 * Electron's runtime, and React only as a string (`test/modSlots.test.ts`);
 * `test/saveService.test.ts` stubs the `electron` module so `main/paths.ts` can root at a temp
 * folder.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@vx/modkit/host': resolve(__dirname, 'packages/modkit/src/host'),
      '@vx/modkit/shared': resolve(__dirname, 'packages/modkit/src/shared'),
      '@vx/modkit/renderer': resolve(__dirname, 'packages/modkit/src/renderer'),
      '@vx/modkit/main': resolve(__dirname, 'packages/modkit/src/main')
    }
  },
  // Components a test reaches through a mod's entry are compiled as the app compiles them.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
