import { defineConfig } from '@playwright/test'

/**
 * Phase 4回帰用の最小E2Eスモーク。出典: docs/logs/phase4-verification-assessment-20260714.md §4タスク2
 * vitest(npm run test)とは対象を分離する(testDir: e2e/、vite.config.tsのtest.excludeでe2e/を除外)。
 */
export default defineConfig({
  testDir: 'e2e',
  use: {
    browserName: 'chromium',
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
