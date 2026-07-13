/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupTests.ts'],
    environmentOptions: {
      // jsdomの既定オリジンは about:blank(opaque origin)で localStorage が使用不可のため明示指定。
      jsdom: {
        url: 'http://localhost/',
      },
    },
  },
})
