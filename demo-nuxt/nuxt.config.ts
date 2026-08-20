import { fileURLToPath } from 'node:url'

// Points at the package's own source, not a published build — this demo
// always exercises current code, same trick demo/vite.config.ts uses for
// the plain-Vite demo.
const src = (p: string) => fileURLToPath(new URL(`../src/${p}`, import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },

  // Registered by relative path, not the package name — Nuxt resolves
  // `modules` entries via Node/jiti before Vite (and its aliases below)
  // even exist, so the package-name alias trick doesn't apply here.
  modules: ['../src/nuxt/module.ts'],

  vueImageKit: {
    breakpoints: {
      sm: '(max-width: 640px)',
      md: '(max-width: 1024px)',
    },
    onDemandServer: {
      root: 'public',
    },
  },

  // Nuxt's own `alias` (not vite.resolve.alias) — it feeds both Vite *and*
  // the generated .nuxt/tsconfig.json, so tsc/the IDE can resolve
  // `import ... from 'vue-image-kit'` in src/nuxt/runtime/plugin.ts too.
  // A vite-only alias wouldn't reach the tsconfig at all.
  alias: {
    'vue-image-kit/cdn': src('cdn/index.ts'),
    'vue-image-kit/server': src('server/index.ts'),
    'vue-image-kit': src('index.ts'),
  },

  // Vite's own `server.warmup.clientFiles` (set internally to the app entry)
  // pre-transforms it on dev-server start, racing Nitro's `#app-manifest`
  // alias registration and spamming "Failed to resolve import
  // '#app-manifest'" in the console — harmless (that import sits behind a
  // dead `if (false)` branch; real requests resolve it fine once the dev
  // server is up) but noisy. `vite.server.warmup` in nuxt.config.ts itself
  // gets array-merged with Nuxt's own entry, not replaced, so the only way
  // to actually clear it is overwriting post-merge in this hook.
  hooks: {
    'vite:extendConfig'(config, { isClient }) {
      if (isClient && config.server) config.server.warmup = { clientFiles: [] }
    },
  },
})
