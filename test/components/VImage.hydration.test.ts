import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import VImage from '../../src/components/VImage.vue'

class FakeMediaQueryList {
  matches: boolean
  media: string
  private listeners = new Set<() => void>()

  constructor(media: string, matches: boolean) {
    this.media = media
    this.matches = matches
  }

  addEventListener(type: string, cb: () => void): void {
    if (type === 'change') this.listeners.add(cb)
  }

  removeEventListener(type: string, cb: () => void): void {
    if (type === 'change') this.listeners.delete(cb)
  }
}

function stubTabletMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => new FakeMediaQueryList(media, media === '(max-width: 1024px)')),
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function renderServerHtml(props: Record<string, unknown>): Promise<string> {
  const app = createSSRApp(VImage, props)
  const originalWindow = globalThis.window
  // @ts-expect-error simulating a real server environment (no window) for this render only
  delete globalThis.window
  try {
    return await renderToString(app)
  } finally {
    globalThis.window = originalWindow
  }
}

async function hydrateAndCollectWarnings(
  html: string,
  props: Record<string, unknown>,
): Promise<string[]> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const app = createSSRApp(VImage, props)
    app.mount(container)
    return warnSpy.mock.calls.flat().filter((arg): arg is string => typeof arg === 'string')
  } finally {
    warnSpy.mockRestore()
    document.body.removeChild(container)
  }
}

describe('VImage SSR hydration', () => {
  it('hydrates the server-rendered idle placeholder without a Vue hydration mismatch', async () => {
    const props = { src: '/img.jpg', alt: 'Mountain landscape', width: 400, height: 300 }
    const html = await renderServerHtml(props)
    expect(html).toContain('<img')

    const warnings = await hydrateAndCollectWarnings(html, props)
    expect(warnings.filter((w) => w.includes('Hydration'))).toEqual([])
  })

  it('hydrates cleanly with lazy=false (immediate-load) props too', async () => {
    const props = {
      src: '/img.jpg',
      alt: 'Mountain landscape',
      width: 400,
      height: 300,
      lazy: false,
      priority: true,
    }
    const html = await renderServerHtml(props)

    const warnings = await hydrateAndCollectWarnings(html, props)
    expect(warnings.filter((w) => w.includes('Hydration'))).toEqual([])
  })

  it('hydrates cleanly with dimensioned art-direction sources, on a tablet-matching viewport', async () => {
    const props = {
      src: '/desktop.jpg',
      alt: 'Mountain landscape',
      width: 720,
      height: 1237,
      breakpoints: { tablet: '(max-width: 1024px)' },
      sources: { tablet: { src: '/tablet.jpg', width: 1400, height: 700 } },
    }
    const html = await renderServerHtml(props)
    expect(html).toContain('/desktop.jpg')

    stubTabletMatchMedia()
    const warnings = await hydrateAndCollectWarnings(html, props)
    expect(warnings.filter((w) => w.includes('Hydration'))).toEqual([])
  })
})
