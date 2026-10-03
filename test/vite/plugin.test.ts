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

  it('detects ?blurhash', () => {
    expect(parseImageRequest('./photo.jpg?blurhash')?.type).toBe('blurhash')
  })

  it('detects ?placeholder and its mode', () => {
    expect(parseImageRequest('./photo.jpg?placeholder')).toMatchObject({ type: 'placeholder' })
    expect(parseImageRequest('./photo.jpg?placeholder')?.mode).toBeUndefined()
    expect(parseImageRequest('./photo.jpg?placeholder=thumbhash')).toMatchObject({ type: 'placeholder', mode: 'thumbhash' })
    expect(parseImageRequest('./photo.jpg?placeholder=color')).toMatchObject({ type: 'placeholder', mode: 'color' })
    expect(parseImageRequest('./photo.jpg?placeholder=blurhash')?.mode).toBe('blurhash')
    expect(parseImageRequest('./photo.jpg?placeholder=bogus')?.mode).toBeUndefined()
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

describe('generate: false', () => {
  beforeEach(() => {
    vi.mocked(generate).mockClear()
  })

  it('skips the batch run on buildStart', async () => {
    const plugin = vueImageKit({ generate: false })
    ;(plugin.configResolved as (c: { command: string }) => void)({ command: 'build' })
    await (plugin.buildStart as () => Promise<void>)()
    expect(vi.mocked(generate)).not.toHaveBeenCalled()
  })

  it('skips regeneration on hot update', async () => {
    const plugin = vueImageKit({ generate: false })
    await (plugin.handleHotUpdate as (c: { file: string }) => Promise<void>)({ file: '/a/photo.jpg' })
    expect(vi.mocked(generate)).not.toHaveBeenCalled()
  })

  it('still generates by default', async () => {
    const plugin = vueImageKit()
    ;(plugin.configResolved as (c: { command: string }) => void)({ command: 'build' })
    await (plugin.buildStart as () => Promise<void>)()
    expect(vi.mocked(generate)).toHaveBeenCalledTimes(1)
  })
})

describe('placeholders manifest watching (dev server)', () => {
  function devServer() {
    const handlers: Record<string, (file: string) => void> = {}
    const module = { id: 'virtual' }
    const server = {
      config: { root: '/project' },
      middlewares: { use: vi.fn() },
      watcher: {
        on: vi.fn((event: string, handler: (file: string) => void) => {
          handlers[event] = handler
        }),
      },
      moduleGraph: {
        getModuleById: vi.fn(() => module),
        invalidateModule: vi.fn(),
      },
      ws: { send: vi.fn() },
    }
    return { server, handlers, module }
  }

  type Configure = (server: unknown) => void

  it('invalidates the virtual module and reloads when an image in the watcher changes', () => {
    const plugin = vueImageKit({ placeholders: { dirs: ['public/images'] } })
    const { server, handlers, module } = devServer()
    ;(plugin.configureServer as Configure)(server)
    handlers['change']!('/project/public/images/cat.jpg')
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(module)
    expect(server.ws.send).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('ignores files that are not images', () => {
    const plugin = vueImageKit({ placeholders: { dirs: ['public/images'] } })
    const { server, handlers } = devServer()
    ;(plugin.configureServer as Configure)(server)
    handlers['add']!('/project/src/App.vue')
    expect(server.ws.send).not.toHaveBeenCalled()
  })

  it('does not watch anything without dirs', () => {
    const plugin = vueImageKit({ generate: false })
    const { server } = devServer()
    ;(plugin.configureServer as Configure)(server)
    expect(server.watcher.on).not.toHaveBeenCalled()
  })
})

describe('hot update regeneration', () => {
  type HotUpdate = (c: { file: string }) => Promise<void>

  async function setup(overrides: Parameters<typeof vueImageKit>[0] = {}) {
    const plugin = vueImageKit({ input: '/p/src/images', output: '/p/public/images', ...overrides })
    ;(plugin.configResolved as (c: { command: string; root: string }) => void)({
      command: 'serve',
      root: '/p',
    })
    return plugin.handleHotUpdate as HotUpdate
  }

  beforeEach(() => {
    vi.mocked(generate).mockReset()
    vi.mocked(generate).mockImplementation(async () => {})
  })

  it('regenerates when an image inside the input directory changes', async () => {
    const hot = await setup()
    await hot({ file: '/p/src/images/photo.jpg' })
    expect(vi.mocked(generate)).toHaveBeenCalledTimes(1)
  })

  it('ignores a change inside the output directory, so its own writes cannot retrigger it', async () => {
    const hot = await setup()
    await hot({ file: '/p/public/images/photo-400.webp' })
    await hot({ file: '/p/public/images/logo.svg' })
    expect(vi.mocked(generate)).not.toHaveBeenCalled()
  })

  it('ignores images outside the input directory and files that are not images', async () => {
    const hot = await setup()
    await hot({ file: '/p/src/assets/icon.svg' })
    await hot({ file: '/p/src/images/readme.md' })
    expect(vi.mocked(generate)).not.toHaveBeenCalled()
  })

  it('ignores the output even when it sits inside the input directory', async () => {
    const hot = await setup({ input: '/p/src/images', output: '/p/src/images/optimized' })
    await hot({ file: '/p/src/images/optimized/photo.webp' })
    expect(vi.mocked(generate)).not.toHaveBeenCalled()
    await hot({ file: '/p/src/images/photo.jpg' })
    expect(vi.mocked(generate)).toHaveBeenCalledTimes(1)
  })

  it('does not loop with incremental: false when generate writes the output and the watcher reports it', async () => {
    const hot = await setup({ incremental: false })
    vi.mocked(generate).mockImplementation(async () => {
      await hot({ file: '/p/public/images/photo-400.webp' })
      await hot({ file: '/p/public/images/logo.svg' })
    })
    await hot({ file: '/p/src/images/photo.jpg' })
    expect(vi.mocked(generate)).toHaveBeenCalledTimes(1)
  })

  it('never runs generate twice at the same time', async () => {
    const hot = await setup()
    let active = 0
    let maxActive = 0
    vi.mocked(generate).mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 15))
      active--
    })
    await Promise.all([
      hot({ file: '/p/src/images/a.jpg' }),
      hot({ file: '/p/src/images/b.jpg' }),
      hot({ file: '/p/src/images/c.jpg' }),
    ])
    expect(maxActive).toBe(1)
    expect(vi.mocked(generate).mock.calls.length).toBeLessThanOrEqual(2)
  })
})

describe('placeholders watching ignores generated output', () => {
  it('does not reload for an image written outside the watched placeholder directories', () => {
    const handlers: Record<string, (file: string) => void> = {}
    const server = {
      config: { root: '/project' },
      middlewares: { use: vi.fn() },
      watcher: { on: vi.fn((event: string, h: (file: string) => void) => (handlers[event] = h)) },
      moduleGraph: { getModuleById: vi.fn(() => ({})), invalidateModule: vi.fn() },
      ws: { send: vi.fn() },
    }
    const plugin = vueImageKit({ generate: false, placeholders: { dirs: ['src/images'] } })
    ;(plugin.configureServer as (s: unknown) => void)(server)
    handlers['add']!('/project/public/images/photo-400.webp')
    handlers['change']!('/project/public/images/logo.svg')
    expect(server.ws.send).not.toHaveBeenCalled()
    handlers['change']!('/project/src/images/cat.jpg')
    expect(server.ws.send).toHaveBeenCalledTimes(1)
  })
})
