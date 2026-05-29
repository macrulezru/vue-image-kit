import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

// Builds the Node-side Vite plugin (src/vite/plugin.ts) → dist/vite/{plugin.js,plugin.cjs}.
// The CLI pipeline it depends on is bundled in; sharp/thumbhash/vite and node
// builtins stay external.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/vite/**/*.ts', 'src/vite/**/*.d.ts'],
      outDir: 'dist/vite',
      // Pin the root so declarations land flat in dist/vite (the plugin imports
      // ../cli/*, which would otherwise push the inferred root up to src/).
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
