import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-image-kit/cdn': resolve(__dirname, '../src/cdn/index.ts'),
      'vue-image-kit': resolve(__dirname, '../src/index.ts'),
    },
  },
})
