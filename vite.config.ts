import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupTests.ts'],
    // e2e/ は @playwright/test 専用(npm run test:e2e)。vitestの対象に混ざらないよう除外する。
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environmentOptions: {
      // jsdomの既定オリジンは about:blank(opaque origin)で localStorage が使用不可のため明示指定。
      jsdom: {
        url: 'http://localhost/',
      },
    },
  },
})
