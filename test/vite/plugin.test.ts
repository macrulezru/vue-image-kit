import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseImageRequest, vueImageKit } from '../../src/vite/plugin'
import { generate } from '../../src/cli/processor'

vi.mock('../../src/cli/processor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/cli/processor')>()
  return { ...actual, generate: vi.fn(async () => {}) }
})

describe('parseImageRequest', () => {
  it('returns null for ids without a query', () => {
    expect(parseImageRequest('./photo.jpg')).toBeNull()
    expect(parseImageRequest('/abs/photo.png')).toBeNull()
  })

  it('returns null for unrelated queries', () => {
    expect(parseImageRequest('./photo.jpg?url')).toBeNull()
    expect(parseImageRequest('./photo.jpg?width=400')).toBeNull()
  })

  it('detects ?vik and strips the query from the path', () => {
    expect(parseImageRequest('./img/photo.jpg?vik')).toEqual({
      filePath: './img/photo.jpg',
      query: 'vik',
      type: 'vik',
    })
  })

  it('detects ?thumbhash', () => {
    const req = parseImageRequest('/abs/photo.png?thumbhash')
    expect(req).toEqual({ filePath: '/abs/photo.png', query: 'thumbhash', type: 'thumbhash' })
  })

  it('recognises the flag alongside other params', () => {
    const req = parseImageRequest('./photo.jpg?foo=1&vik&bar=2')
    expect(req?.type).toBe('vik')
    expect(req?.filePath).toBe('./photo.jpg')
    expect(req?.query).toBe('foo=1&vik&bar=2')
  })

  it('prefers vik when both flags are present', () => {
    expect(parseImageRequest('./photo.jpg?vik&thumbhash')?.type).toBe('vik')
  })

  it('keeps the query (including the path) intact for absolute Windows-style paths', () => {
    const req = parseImageRequest('C:/proj/photo.jpg?thumbhash')
    expect(req?.filePath).toBe('C:/proj/photo.jpg')
    expect(req?.type).toBe('thumbhash')
  })
})

describe('vueImageKit plugin shape', () => {
  it('exposes the expected hooks', () => {
    const plugin = vueImageKit()
    expect(plugin.name).toBe('vue-image-kit')
    expect(plugin.enforce).toBe('pre')
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
    expect(typeof plugin.buildStart).toBe('function')
    expect(typeof plugin.handleHotUpdate).toBe('function')
    expect(typeof plugin.configureServer).toBe('function')
  })
})

describe('configureServer (on-demand dev middleware)', () => {
  function mockServer(root = '/project') {
    const use = vi.fn()
    return { server: { config: { root }, middlewares: { use } } as unknown as Parameters<NonNullable<ReturnType<typeof vueImageKit>['configureServer']>>[0], use }
  }

  it('does not mount middleware when dev.onDemand is unset', () => {
    const plugin = vueImageKit()
    const { server, use } = mockServer()
    ;(plugin.configureServer as (s: typeof server) => void)(server)
    expect(use).not.toHaveBeenCalled()
  })

  it('mounts middleware at the default route when dev.onDemand is true', () => {
    const plugin = vueImageKit({ dev: { onDemand: true } })
    const { server, use } = mockServer()
    ;(plugin.configureServer as (s: typeof server) => void)(server)
    expect(use).toHaveBeenCalledWith('/_vik/image', expect.any(Function))
  })

  it('mounts middleware at a custom route', () => {
    const plugin = vueImageKit({ dev: { onDemand: true, route: '/images/on-demand' } })
    const { server, use } = mockServer()
    ;(plugin.configureServer as (s: typeof server) => void)(server)
    expect(use).toHaveBeenCalledWith('/images/on-demand', expect.any(Function))
  })
})

describe('incremental auto-default', () => {
  beforeEach(() => {
    vi.mocked(generate).mockClear()
  })

  async function runBuildStart(plugin: ReturnType<typeof vueImageKit>, command: 'serve' | 'build') {
    ;(plugin.configResolved as (c: { command: string }) => void)({ command })
    await (plugin.buildStart as () => Promise<void>)()
  }

  it('defaults incremental to true in dev (vite dev)', async () => {
    const plugin = vueImageKit()
    await runBuildStart(plugin, 'serve')
    expect(vi.mocked(generate)).toHaveBeenCalledWith(expect.objectContaining({ incremental: true }))
  })

  it('defaults incremental to false in a one-shot build (vite build)', async () => {
    const plugin = vueImageKit()
    await runBuildStart(plugin, 'build')
    expect(vi.mocked(generate)).toHaveBeenCalledWith(expect.objectContaining({ incremental: false }))
  })

  it('an explicit incremental:false in plugin options wins even in dev', async () => {
    const plugin = vueImageKit({ incremental: false })
    await runBuildStart(plugin, 'serve')
    expect(vi.mocked(generate)).toHaveBeenCalledWith(expect.objectContaining({ incremental: false }))
  })

  it('an explicit incremental:true in plugin options is respected in build mode too', async () => {
    const plugin = vueImageKit({ incremental: true })
    await runBuildStart(plugin, 'build')
    expect(vi.mocked(generate)).toHaveBeenCalledWith(expect.objectContaining({ incremental: true }))
  })
})
