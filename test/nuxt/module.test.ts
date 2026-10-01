import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import {
  resolveModuleConfig,
  DEFAULT_SERVER_ROUTE,
  AUTO_IMPORT_NAMES,
  placeholdersPluginContents,
  resolvePlaceholdersSetup,
} from '../../src/nuxt/module'
import * as indexExports from '../../src/index'

describe('resolveModuleConfig', () => {
  it('defaults to the standard route with no breakpoints and no server config', () => {
    const result = resolveModuleConfig({}, '/project')
    expect(result.effectiveRoute).toBe(DEFAULT_SERVER_ROUTE)
    expect(result.publicConfig).toEqual({ breakpoints: {}, serverRoute: DEFAULT_SERVER_ROUTE })
    expect(result.serverConfig).toBeNull()
  })

  it('passes breakpoints through to publicConfig', () => {
    const result = resolveModuleConfig({ breakpoints: { sm: '(max-width: 640px)' } }, '/project')
    expect(result.publicConfig.breakpoints).toEqual({ sm: '(max-width: 640px)' })
  })

  it('an explicit serverRoute overrides the default everywhere', () => {
    const result = resolveModuleConfig({ serverRoute: '/api/images' }, '/project')
    expect(result.effectiveRoute).toBe('/api/images')
    expect(result.publicConfig.serverRoute).toBe('/api/images')
  })

  it('onDemandServer: true resolves root to <rootDir>/public with the default route', () => {
    const result = resolveModuleConfig({ onDemandServer: true }, '/project')
    expect(result.serverConfig).not.toBeNull()
    expect(result.serverConfig!.root).toBe(resolve('/project', 'public'))
    expect(result.effectiveRoute).toBe(DEFAULT_SERVER_ROUTE)
  })

  it('onDemandServer.route sets both the handler route and the client default', () => {
    const result = resolveModuleConfig({ onDemandServer: { route: '/api/images' } }, '/project')
    expect(result.effectiveRoute).toBe('/api/images')
    expect(result.publicConfig.serverRoute).toBe('/api/images')
  })

  it('a top-level serverRoute wins over onDemandServer.route', () => {
    const result = resolveModuleConfig(
      { serverRoute: '/preferred', onDemandServer: { route: '/other' } },
      '/project',
    )
    expect(result.effectiveRoute).toBe('/preferred')
  })

  it('resolves a custom onDemandServer.root against rootDir', () => {
    const result = resolveModuleConfig({ onDemandServer: { root: 'static' } }, '/project')
    expect(result.serverConfig!.root).toBe(resolve('/project', 'static'))
  })

  it('passes through cacheDir/maxAge/allowedWidths/maxWidth only when set', () => {
    const result = resolveModuleConfig(
      { onDemandServer: { maxAge: 3600, allowedWidths: [400, 800] } },
      '/project',
    )
    expect(result.serverConfig).toMatchObject({ maxAge: 3600, allowedWidths: [400, 800] })
    expect(result.serverConfig).not.toHaveProperty('cacheDir')
    expect(result.serverConfig).not.toHaveProperty('maxWidth')
  })
})

describe('AUTO_IMPORT_NAMES', () => {
  const intentionallyExcluded = new Set([
    'VImage',
    'vLazyImg',
    'VImageKitPlugin',
    'default',
    'BREAKPOINTS_KEY',
    'SERVER_ROUTE_KEY',
    'PLACEHOLDERS_KEY',
  ])

  it('covers every real value export from the package root except the intentionally-excluded ones', () => {
    const realExports = Object.keys(indexExports)
    const covered = new Set(AUTO_IMPORT_NAMES as readonly string[])

    const missing = realExports.filter(
      (name) => !intentionallyExcluded.has(name) && !covered.has(name),
    )
    expect(missing).toEqual([])
  })

  it("doesn't list a name that isn't actually exported from the package root", () => {
    const realExports = new Set(Object.keys(indexExports))
    const stale = AUTO_IMPORT_NAMES.filter((name) => !realExports.has(name))
    expect(stale).toEqual([])
  })
})

describe('placeholdersPluginContents', () => {
  it('generates a plugin that provides the manifest under PLACEHOLDERS_KEY', () => {
    const contents = placeholdersPluginContents(String.raw`C:\project\app\image-placeholders.ts`)
    expect(contents).toContain("import { PLACEHOLDERS_KEY } from '@macrulez/vue-image-kit'")
    expect(contents).toContain('import placeholders from "C:/project/app/image-placeholders.ts"')
    expect(contents).toContain('nuxtApp.vueApp.provide(PLACEHOLDERS_KEY, placeholders)')
  })
})

describe('placeholdersPluginContents with folders', () => {
  it('imports the virtual module and merges it with a manifest file', () => {
    const contents = placeholdersPluginContents('/project/image-placeholders.ts', true)
    expect(contents).toContain("import folderPlaceholders from 'virtual:vue-image-kit/placeholders'")
    expect(contents).toContain('import manifestPlaceholders from "/project/image-placeholders.ts"')
    expect(contents).toContain(
      'provide(PLACEHOLDERS_KEY, { ...folderPlaceholders, ...manifestPlaceholders })',
    )
  })

  it('provides just the virtual module when there is no manifest file', () => {
    const contents = placeholdersPluginContents(null, true)
    expect(contents).not.toContain('manifestPlaceholders')
    expect(contents).toContain('provide(PLACEHOLDERS_KEY, { ...folderPlaceholders })')
  })
})

describe('resolvePlaceholdersSetup', () => {
  it('returns nothing when unset', () => {
    expect(resolvePlaceholdersSetup(undefined, '/project')).toEqual({
      manifestPath: null,
      viteOptions: null,
    })
  })

  it('treats a string as a manifest file, as before', () => {
    const setup = resolvePlaceholdersSetup('./image-placeholders.ts', '/project')
    expect(setup.manifestPath).toMatch(/image-placeholders\.ts$/)
    expect(setup.viteOptions).toBeNull()
  })

  it('an object with only a manifest does not register the Vite plugin', () => {
    const setup = resolvePlaceholdersSetup({ manifest: './m.ts' }, '/project')
    expect(setup.manifestPath).toMatch(/m\.ts$/)
    expect(setup.viteOptions).toBeNull()
  })

  it('resolves dirs against the project root and sets the root and public dir', () => {
    const setup = resolvePlaceholdersSetup(
      { dirs: ['src/img', { dir: 'public/x', urlPrefix: '/cdn' }], mode: 'thumbhash' },
      '/project',
    )
    expect(setup.manifestPath).toBeNull()
    const options = setup.viteOptions!
    expect(options.mode).toBe('thumbhash')
    expect(options.root).toBe('/project')
    expect(options.publicDir).toBe(resolve('/project', 'public'))
    expect(options.dirs).toHaveLength(2)
    expect((options.dirs![0] as { dir: string }).dir).toBe(resolve('/project', 'src/img'))
    expect(options.dirs![1]).toMatchObject({ urlPrefix: '/cdn' })
  })

  it('registers the plugin for urls only', () => {
    expect(resolvePlaceholdersSetup({ urls: ['https://x/y.jpg'] }, '/project').viteOptions).not.toBeNull()
  })
})
