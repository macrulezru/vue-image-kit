import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/vite/**/*.ts', 'src/vite/**/*.d.ts'],
      outDir: 'dist/vite',
      entryRoot: 'src/vite',
      tsconfigPath: './tsconfig.vite.json',
      copyDtsFiles: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/vite/plugin.ts'),
      fileName: (format) => `plugin.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    outDir: 'dist/vite',
    emptyOutDir: true,
    rollupOptions: {
      external: ['vite', 'sharp', 'thumbhash', /^node:/],
      output: { exports: 'named' },
    },
    minify: false,
    target: 'es2020',
  },
})
