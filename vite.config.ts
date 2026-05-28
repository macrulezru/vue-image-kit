import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: [
        'src/*.ts',
        'src/components/**/*.{ts,vue}',
        'src/composables/**/*.ts',
        'src/directives/**/*.ts',
        'src/types/**/*.ts',
        'src/utils/**/*.ts',
        'src/cdn/**/*.ts',
      ],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueImageKit',
      fileName: 'vue-image-kit',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        exports: 'named',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
})
