import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/nuxt/**/*.ts', 'src/nuxt/**/*.d.ts'],
      outDir: 'dist/nuxt',
      // Pin the root so declarations land flat in dist/nuxt to match the
      // package "./nuxt" types export (the module imports
      // '@macrulez/vue-image-kit', which would otherwise push the inferred
      // root up a level).
      entryRoot: 'src/nuxt',
      tsconfigPath: './tsconfig.nuxt.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        module: resolve(__dirname, 'src/nuxt/module.ts'),
        'runtime/plugin': resolve(__dirname, 'src/nuxt/runtime/plugin.ts'),
        'runtime/server-handler': resolve(__dirname, 'src/nuxt/runtime/server-handler.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist/nuxt',
    emptyOutDir: true,
    rollupOptions: {
      // module.ts and runtime/server-handler.ts are Node-only (module setup
      // runs during Nuxt's own build; the server handler runs in Nitro) —
      // node builtins must stay external, not get browser-externalized.
      external: ['@nuxt/kit', '#app', '#imports', 'vue', '@macrulez/vue-image-kit', 'sharp', /^node:/],
      output: { exports: 'named' },
    },
    minify: false,
    target: 'es2020',
  },
})
