import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import VImage from '../../src/components/VImage.vue'
import { registerPlaceholder } from '../../src/utils/placeholder-registry'

const PREVIEW = 'data:image/png;base64,PREVIEWDATA'

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as Record<string, unknown>)['__VIK_PLACEHOLDERS__']
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

async function hydrationWarnings(html: string, props: Record<string, unknown>): Promise<string[]> {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    createSSRApp(VImage, props).mount(container)
    return warnSpy.mock.calls
      .flat()
      .filter((arg): arg is string => typeof arg === 'string' && arg.includes('Hydration'))
  } finally {
    warnSpy.mockRestore()
    document.body.removeChild(container)
  }
}

describe('VImage ssrPlaceholder', () => {
  const base = { src: '/img.jpg', alt: 'Photo', width: 400, height: 300 }

  it('puts the ready preview on the server-rendered image as a background', async () => {
    const html = await renderServerHtml({ ...base, placeholder: PREVIEW, ssrPlaceholder: true })
    expect(html).toContain('<img')
    expect(html).toContain(`background-image:url(${PREVIEW})`)
    expect(html).toContain('background-size:cover')
  })

  it('holds the real image back on the server: a pixel instead of the src, the real one in noscript', async () => {
    const html = await renderServerHtml({
      ...base,
      src: '/img.jpg?a=1&b=2',
      alt: 'A "quoted" <alt>',
      placeholder: PREVIEW,
      ssrPlaceholder: true,
    })
    const img = html.match(/<img[^>]*>/)![0]
    expect(img).toContain('src="data:image/gif;base64,')
    expect(img).not.toContain('/img.jpg')
    expect(html).toContain('<img src="/img.jpg?a=1&amp;b=2" alt="A &quot;quoted&quot; &lt;alt&gt;"')
    expect(html).toMatch(/<noscript[^>]*><img src=/)
  })

  it('keeps the real src for an eager image (lazy=false or priority), with the preview behind it', async () => {
    for (const extra of [{ lazy: false }, { priority: true }]) {
      const html = await renderServerHtml({ ...base, placeholder: PREVIEW, ssrPlaceholder: true, ...extra })
      const img = html.match(/<img[^>]*>/)![0]
      expect(img).toContain('src="/img.jpg"')
      expect(img).toContain('background-image')
      expect(html).not.toContain('<noscript')
    }
  })

  it('hydrates a deferred image without a mismatch', async () => {
    const props = { ...base, placeholder: PREVIEW, ssrPlaceholder: true }
    const html = await renderServerHtml(props)
    expect(html).toContain('<noscript')
    expect(await hydrationWarnings(html, props)).toEqual([])
  })

  it('does nothing without the prop, even when a preview is given', async () => {
    const html = await renderServerHtml({ ...base, placeholder: PREVIEW })
    expect(html).not.toContain('background-image')
  })

  it('does nothing when there is no preview to show', async () => {
    const html = await renderServerHtml({ ...base, ssrPlaceholder: true })
    expect(html).not.toContain('background-image')
  })

  it('takes the preview of an image from the registry', async () => {
    registerPlaceholder('/img.jpg', { blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj', placeholder: PREVIEW })
    const html = await renderServerHtml({ ...base, ssrPlaceholder: true })
    expect(html).toContain(`background-image:url(${PREVIEW})`)
  })

  it('leaves the color and shimmer modes alone', async () => {
    const color = await renderServerHtml({
      ...base,
      placeholder: PREVIEW,
      ssrPlaceholder: true,
      placeholderColor: '#123456',
    })
    expect(color).not.toContain('background-image')
    const shimmer = await renderServerHtml({
      ...base,
      placeholder: PREVIEW,
      ssrPlaceholder: true,
      placeholderMode: 'shimmer',
    })
    expect(shimmer).not.toContain('background-image')
  })

  it('hydrates without a mismatch, with and without the prop', async () => {
    const withProp = { ...base, placeholder: PREVIEW, ssrPlaceholder: true }
    expect(await hydrationWarnings(await renderServerHtml(withProp), withProp)).toEqual([])
    const without = { ...base, placeholder: PREVIEW }
    expect(await hydrationWarnings(await renderServerHtml(without), without)).toEqual([])
  })
})
