import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/cdn/**/*.ts'],
      outDir: 'dist/cdn',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/cdn/index.ts'),
      name: 'VueImageKitCdn',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist/cdn',
    emptyOutDir: true,
    rollupOptions: {
      output: { exports: 'named' },
    },
    minify: 'esbuild',
    target: 'es2020',
  },
})
