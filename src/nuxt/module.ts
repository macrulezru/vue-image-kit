import {
  defineNuxtModule,
  addPlugin,
  addServerHandler,
  createResolver,
  addImports,
  addPluginTemplate,
  addVitePlugin,
  resolvePath,
} from '@nuxt/kit'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { BreakpointMap } from '../types'
import type { PlaceholdersPluginOptions } from '../vite/placeholder'

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
  placeholders?: string | NuxtPlaceholdersOptions
}

export interface NuxtPlaceholdersOptions extends PlaceholdersPluginOptions {
  manifest?: string
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

export interface PlaceholdersSetup {
  manifestPath: string | null
  viteOptions: PlaceholdersPluginOptions | null
}

export function resolvePlaceholdersSetup(
  setting: string | NuxtPlaceholdersOptions | undefined,
  rootDir: string,
): PlaceholdersSetup {
  if (!setting) return { manifestPath: null, viteOptions: null }
  if (typeof setting === 'string') {
    return { manifestPath: resolve(rootDir, setting), viteOptions: null }
  }
  const { manifest, ...rest } = setting
  const manifestPath = manifest ? resolve(rootDir, manifest) : null
  const hasSources = (rest.dirs?.length ?? 0) > 0 || (rest.urls?.length ?? 0) > 0
  if (!hasSources) return { manifestPath, viteOptions: null }
  return {
    manifestPath,
    viteOptions: {
      ...rest,
      root: rootDir,
      dirs: (rest.dirs ?? []).map((input) => {
        const spec = typeof input === 'string' ? { dir: input } : input
        return {
          ...spec,
          dir: isAbsolute(spec.dir) ? spec.dir : resolve(rootDir, spec.dir),
        }
      }),
      publicDir: rest.publicDir
        ? isAbsolute(rest.publicDir)
          ? rest.publicDir
          : resolve(rootDir, rest.publicDir)
        : resolve(rootDir, 'public'),
    },
  }
}

export function placeholdersPluginContents(manifestPath: string | null, virtual = false): string {
  const lines = [
    `import { defineNuxtPlugin } from '#app'`,
    `import { PLACEHOLDERS_KEY } from '@macrulez/vue-image-kit'`,
  ]
  const parts: string[] = []
  if (virtual) {
    lines.push(`import folderPlaceholders from 'virtual:vue-image-kit/placeholders'`)
    parts.push('...folderPlaceholders')
  }
  if (manifestPath) {
    const name = virtual ? 'manifestPlaceholders' : 'placeholders'
    lines.push(`import ${name} from ${JSON.stringify(manifestPath.replace(/\\/g, '/'))}`)
    parts.push(virtual ? '...manifestPlaceholders' : 'placeholders')
  }
  const value = parts.length === 1 && !virtual ? parts[0] : `{ ${parts.join(', ')} }`
  return [
    ...lines,
    ``,
    `export default defineNuxtPlugin((nuxtApp) => {`,
    `  nuxtApp.vueApp.provide(PLACEHOLDERS_KEY, ${value})`,
    `})`,
    ``,
  ].join('\n')
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

  async setup(options, nuxt) {
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

    const { manifestPath, viteOptions } = resolvePlaceholdersSetup(
      options.placeholders,
      nuxt.options.rootDir,
    )
    if (viteOptions) {
      const pluginPath = await resolvePath(resolver.resolve('../vite/plugin'))
      const { vueImageKit } = (await import(
        pathToFileURL(pluginPath).href
      )) as typeof import('../vite/plugin')
      addVitePlugin(vueImageKit({ generate: false, placeholders: viteOptions }))
    }
    if (manifestPath || viteOptions) {
      addPluginTemplate({
        filename: 'vue-image-kit-placeholders.mjs',
        getContents: () => placeholdersPluginContents(manifestPath, viteOptions !== null),
      })
    }

    addImports(AUTO_IMPORT_NAMES.map((name) => ({ name, from: '@macrulez/vue-image-kit' })))

    nuxt.options.css.push('@macrulez/vue-image-kit/style.css')
  },
})
