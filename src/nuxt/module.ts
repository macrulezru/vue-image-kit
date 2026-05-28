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
  createResolver,
  addImports,
} from '@nuxt/kit'
import type { BreakpointMap } from '../types'

export interface ModuleOptions {
  breakpoints?: BreakpointMap
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

    // Inject breakpoints config so the plugin can read it at runtime
    nuxt.options.runtimeConfig.public.vueImageKit = {
      breakpoints: options.breakpoints ?? {},
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
