import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/server/**/*.ts'],
      outDir: 'dist/server',
      tsconfigPath: './tsconfig.server.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/server/index.ts'),
      name: 'VueImageKitServer',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist/server',
    emptyOutDir: true,
    rollupOptions: {
      // Node builtins + the optional sharp peer dep must stay external —
      // this is a Node-only entry, never bundled for the browser.
      external: [
        'sharp',
        /^node:/,
      ],
      output: { exports: 'named' },
    },
    minify: false,
    target: 'node18',
  },
})
