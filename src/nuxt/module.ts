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

export const AUTO_IMPORT_NAMES = [
  'useImage',
  'useBlurhash',
  'useLazyLoad',
  'useBreakpoints',
  'useImagePreloader',
  'useBackgroundImage',
  'useNetworkAware',
  'isSaveDataEnabled',
  'useServerRoute',
  'generateSrcset',
  'generateSizes',
  'generateDensitySrcset',
  'buildSizes',
  'generatePreloadLink',
  'pickSmallestSrcsetUrl',
  'decodeBlurhash',
  'decodeThumbHash',
  'thumbHashToAverageRGBA',
  'thumbHashToAverageColor',
  'encodeBlurhash',
  'encodeThumbHash',
] as const

export interface OnDemandServerOptions {
  root?: string
  cacheDir?: string
  maxAge?: number
  allowedWidths?: number[]
  maxWidth?: number
  route?: string
}

export interface ModuleOptions {
  breakpoints?: BreakpointMap
  serverRoute?: string
  onDemandServer?: OnDemandServerOptions | boolean
}

export interface ResolvedModuleConfig {
  effectiveRoute: string
  publicConfig: { breakpoints: BreakpointMap; serverRoute: string }
  serverConfig: (OnDemandServerOptions & { root: string }) | null
}

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

    ;(nuxt.options.runtimeConfig.public as Record<string, unknown>).vueImageKit = publicConfig

    if (serverConfig) {
      ;(nuxt.options.runtimeConfig as Record<string, unknown>).vueImageKitServer = serverConfig

      addServerHandler({
        route: effectiveRoute,
        handler: resolver.resolve('./runtime/server-handler'),
      })
    }

    addPlugin(resolver.resolve('./runtime/plugin'))

    addImports(AUTO_IMPORT_NAMES.map((name) => ({ name, from: '@macrulez/vue-image-kit' })))
  },
})
