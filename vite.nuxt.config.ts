import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/nuxt/**/*.ts', 'src/nuxt/**/*.d.ts'],
      outDir: 'dist/nuxt',
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
      external: ['@nuxt/kit', '#app', '#imports', 'vue', '@macrulez/vue-image-kit', 'sharp', /^node:/],
      output: { exports: 'named' },
    },
    minify: false,
    target: 'es2020',
  },
})
