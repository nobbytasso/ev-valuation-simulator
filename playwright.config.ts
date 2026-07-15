import { defineConfig } from '@playwright/test'

/**
 * Phase 4回帰用の最小E2Eスモーク。出典: docs/logs/phase4-verification-assessment-20260714.md §4タスク2
 * vitest(npm run test)とは対象を分離する(testDir: e2e/、vite.config.tsのtest.excludeでe2e/を除外)。
 */
export default defineConfig({
  testDir: 'e2e',
  // CI(2coreランナー)は手元より遅く、タイミング依存の演出系テストがflakeし得るため
  // リトライを許容する。決定的な失敗はリトライしても失敗し、trace/reportで診断できる。
  retries: process.env.CI ? 2 : 0,
  use: {
    browserName: 'chromium',
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
