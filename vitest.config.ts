import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/index.ts'],
    },
  },
})
