import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/nuxt/**/*.ts', 'src/nuxt/**/*.d.ts'],
      outDir: 'dist/nuxt',
      tsconfigPath: './tsconfig.nuxt.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        module: resolve(__dirname, 'src/nuxt/module.ts'),
        'runtime/plugin': resolve(__dirname, 'src/nuxt/runtime/plugin.ts'),
      },
      formats: ['es'],
    },
    outDir: 'dist/nuxt',
    emptyOutDir: true,
    rollupOptions: {
      external: ['@nuxt/kit', '#app', 'vue', 'vue-image-kit'],
      output: { exports: 'named' },
    },
    minify: false,
    target: 'es2020',
  },
})
