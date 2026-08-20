/**
 * Nuxt 3 module for vue-image-kit.
 *
 * Registers <VImage> and v-lazy-img globally, exposes composables via auto-imports,
 * and accepts the same breakpoints config as the Vue plugin.
 *
 * Usage in nuxt.config.ts:
 *   modules: ['vue-image-kit/nuxt'],
 *   vueImageKit: { breakpoints: { sm: '(max-width: 640px)' } }
 */
import {
  defineNuxtModule,
  addPlugin,
  addServerHandler,
  createResolver,
  addImports,
} from '@nuxt/kit'
import { resolve } from 'node:path'
import type { BreakpointMap } from '../types'

export const DEFAULT_SERVER_ROUTE = '/_vik/image'

export interface OnDemandServerOptions {
  /** Directory `src` is resolved (and confined) to. Default: `public` (Nuxt's own static-serve dir), resolved against the project root. */
  root?: string
  cacheDir?: string
  maxAge?: number
  allowedWidths?: number[]
  maxWidth?: number
  /** Route to mount the handler at. Default: `/_vik/image`. Also becomes the client-side `loader="server"` default — set `serverRoute` instead if you want those to differ. */
  route?: string
}

export interface ModuleOptions {
  breakpoints?: BreakpointMap
  /** Default route for `VImage`'s `loader="server"`. Default: `/_vik/image` (or `onDemandServer.route`, if that's set). Only needs setting directly when the on-demand handler lives somewhere this module didn't register itself. */
  serverRoute?: string
  /** Registers `vue-image-kit/server`'s on-demand image handler as a Nitro server route — `true` for defaults, or an object to configure it. Unset: no server route is registered. */
  onDemandServer?: OnDemandServerOptions | boolean
}

export interface ResolvedModuleConfig {
  effectiveRoute: string
  publicConfig: { breakpoints: BreakpointMap; serverRoute: string }
  serverConfig: (OnDemandServerOptions & { root: string }) | null
}

/**
 * Pure computation extracted out of `setup()` so it's testable without a
 * real Nuxt/Nitro context — `@nuxt/kit`'s `addServerHandler`/`addPlugin`/etc.
 * require a live `useNuxt()` singleton that only exists inside an actual
 * Nuxt build, so unlike the rest of this session's work, the module-wiring
 * side of this feature could not be exercised against a running Nuxt app in
 * this environment. This function is the part that actually *can* be
 * verified in isolation.
 */
export function resolveModuleConfig(options: ModuleOptions, rootDir: string): ResolvedModuleConfig {
  const onDemand = options.onDemandServer
  const onDemandOpts: OnDemandServerOptions = typeof onDemand === 'object' ? onDemand : {}
  const effectiveRoute = options.serverRoute ?? onDemandOpts.route ?? DEFAULT_SERVER_ROUTE

  return {
    effectiveRoute,
    publicConfig: {
      breakpoints: options.breakpoints ?? {},
      serverRoute: effectiveRoute,
    },
    serverConfig: onDemand
      ? {
          root: resolve(rootDir, onDemandOpts.root ?? 'public'),
          ...(onDemandOpts.cacheDir !== undefined ? { cacheDir: onDemandOpts.cacheDir } : {}),
          ...(onDemandOpts.maxAge !== undefined ? { maxAge: onDemandOpts.maxAge } : {}),
          ...(onDemandOpts.allowedWidths !== undefined ? { allowedWidths: onDemandOpts.allowedWidths } : {}),
          ...(onDemandOpts.maxWidth !== undefined ? { maxWidth: onDemandOpts.maxWidth } : {}),
        }
      : null,
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'vue-image-kit',
    configKey: 'vueImageKit',
    compatibility: { nuxt: '>=3.0.0' },
  },

  defaults: {
    breakpoints: {},
  },

  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const { effectiveRoute, publicConfig, serverConfig } = resolveModuleConfig(options, nuxt.options.rootDir)

    // Inject breakpoints + the server-loader route so the plugin can read
    // them at runtime — same mechanism, one shared runtime config entry.
    // Cast the target, not the value: Nuxt infers `RuntimeConfig.public`'s
    // shape from the literal `vueImageKit: {...}` a consuming app writes in
    // its own nuxt.config.ts, which can end up narrower than `PublicConfig`
    // (e.g. `{ sm: string; md: string }` instead of `BreakpointMap`) for any
    // app whose breakpoints object happens to type-infer that way — a
    // generic module has no way to predict that shape in advance.
    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).vueImageKit = publicConfig

    if (serverConfig) {
      // Private (server-only) runtime config — filesystem paths have no
      // business being exposed to the client, unlike .public above.
      ;(nuxt.options.runtimeConfig as Record<string, unknown>).vueImageKitServer = serverConfig

      addServerHandler({
        route: effectiveRoute,
        handler: resolver.resolve('./runtime/server-handler'),
      })
    }

    // Register Vue plugin (registers VImage component + v-lazy-img directive)
    addPlugin(resolver.resolve('./runtime/plugin'))

    // Auto-imports for composables — no explicit import needed in components
    addImports([
      { name: 'useImage',          from: 'vue-image-kit' },
      { name: 'useBlurhash',       from: 'vue-image-kit' },
      { name: 'useLazyLoad',       from: 'vue-image-kit' },
      { name: 'useImagePreloader', from: 'vue-image-kit' },
      { name: 'generateSrcset',    from: 'vue-image-kit' },
      { name: 'generateSizes',     from: 'vue-image-kit' },
      { name: 'buildSizes',        from: 'vue-image-kit' },
      { name: 'generatePreloadLink', from: 'vue-image-kit' },
      { name: 'decodeBlurhash',    from: 'vue-image-kit' },
      { name: 'decodeThumbHash',   from: 'vue-image-kit' },
    ])
  },
})
