import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { resolveModuleConfig, DEFAULT_SERVER_ROUTE, AUTO_IMPORT_NAMES } from '../../src/nuxt/module'
import * as indexExports from '../../src/index'

// resolveModuleConfig is the pure part of module.ts's setup() — extracted
// specifically so it's testable without a live Nuxt/Nitro context, which
// @nuxt/kit's addServerHandler/addPlugin/etc. require and this environment
// can't provide. The addServerHandler/addPlugin wiring itself is NOT
// exercised by these tests, or by a running Nuxt app — flagging that
// honestly rather than claiming full coverage.

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
  // VImage/vLazyImg are registered separately as a global component/directive
  // (addPlugin), VImageKitPlugin installs itself so auto-importing it would be
  // pointless, and the two injection-key constants are advanced escape hatches
  // a Nuxt app using this module never needs directly.
  const intentionallyExcluded = new Set([
    'VImage',
    'vLazyImg',
    'VImageKitPlugin',
    'default',
    'BREAKPOINTS_KEY',
    'SERVER_ROUTE_KEY',
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
