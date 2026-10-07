import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VImage from '../../src/components/VImage.vue'
import { VImageKitPlugin } from '../../src/index'
import { BREAKPOINTS_KEY } from '../../src/composables/useBreakpoints'
import { PLACEHOLDERS_KEY } from '../../src/utils/placeholders'
import { clearObserverPool } from '../../src/utils/observer-pool'
import type { PlaceholderManifest } from '../../src/types'

type IOCallback = (entries: IntersectionObserverEntry[]) => void
let ioCallback: IOCallback | null = null

const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'
const THUMBHASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

const manifest: PlaceholderManifest = {
  '/photo.jpg': { blurhash: BLURHASH, color: '#123456', width: 800, height: 600 },
  '/logo.svg': { color: '#7c3aed', width: 120, height: 60 },
  'https://cdn.example.com/a.jpg': { thumbhash: THUMBHASH, color: '#abcdef' },
}

beforeEach(() => {
  ioCallback = null
  clearObserverPool()
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IOCallback) => {
      ioCallback = cb
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
    }),
  )
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      media,
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearObserverPool()
})

function mountWithManifest(
  props: Record<string, unknown>,
  placeholders: PlaceholderManifest = manifest,
) {
  return mount(VImage, {
    props: { alt: 'Test', ...props },
    global: { provide: { [PLACEHOLDERS_KEY as symbol]: placeholders } },
  })
}

function placeholderStyle(wrapper: ReturnType<typeof mount>): string {
  return wrapper.find('img[aria-hidden="true"]').attributes('style') ?? ''
}

describe('VImage — placeholders manifest', () => {
  it('fills blurhash and size from the manifest entry matching src', async () => {
    const wrapper = mountWithManifest({ src: '/photo.jpg' })
    await nextTick()
    const style = placeholderStyle(wrapper)
    expect(style).toContain('background-image: url("data:image/png;base64,MOCK')
    expect(style).toContain('aspect-ratio: 800 / 600')
  })

  it('renders the manifest size on the real <img> once loading starts', async () => {
    const wrapper = mountWithManifest({ src: '/photo.jpg', lazy: false })
    await nextTick()
    ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
    await nextTick()
    await nextTick()
    const img = wrapper.find('img:not([aria-hidden])')
    expect(img.attributes('width')).toBe('800')
    expect(img.attributes('height')).toBe('600')
  })

  it('lets explicit props win over the manifest entry', async () => {
    const wrapper = mountWithManifest({
      src: '/photo.jpg',
      width: 100,
      height: 50,
      placeholderColor: 'rgb(1, 2, 3)',
    })
    await nextTick()
    const style = placeholderStyle(wrapper)
    expect(style).toContain('background-color: rgb(1, 2, 3)')
    expect(style).toContain('aspect-ratio: 100 / 50')
  })

  it('uses the manifest dominant color when the entry has no hash', async () => {
    const wrapper = mountWithManifest({ src: '/logo.svg' })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(124, 58, 237)')
  })

  it('prefers the blurhash over the manifest color unless placeholderMode="color"', async () => {
    const blur = mountWithManifest({ src: '/photo.jpg' })
    const color = mountWithManifest({ src: '/photo.jpg', placeholderMode: 'color' })
    await nextTick()
    expect(placeholderStyle(blur)).not.toContain('rgb(18, 52, 86)')
    expect(placeholderStyle(color)).toContain('background-color: rgb(18, 52, 86)')
  })

  it('does not let the manifest color override a placeholder passed as a prop', async () => {
    const wrapper = mountWithManifest({ src: '/logo.svg', thumbhash: THUMBHASH })
    await nextTick()
    const style = placeholderStyle(wrapper)
    expect(style).not.toContain('rgb(124, 58, 237)')
    expect(style).toContain('background-image: url("data:')
  })

  it('looks a SrcSet up by its fallback', async () => {
    const wrapper = mountWithManifest({ src: { fallback: '/photo.jpg', webp: '/photo.webp' } })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('aspect-ratio: 800 / 600')
  })

  it('matches remote URLs exactly and uses a thumbhash entry', async () => {
    const wrapper = mountWithManifest({ src: 'https://cdn.example.com/a.jpg' })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-image: url("data:')
  })

  it('leaves images without an entry unchanged', async () => {
    const wrapper = mountWithManifest({ src: '/other.jpg' })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(243, 244, 246)')
  })

  it('is provided by VImageKitPlugin through the placeholders option', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/logo.svg', alt: 'Logo' },
      global: { plugins: [[VImageKitPlugin, { placeholders: manifest }]] },
    })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(124, 58, 237)')
  })

  it('works without any manifest provided', async () => {
    const wrapper = mount(VImage, { props: { src: '/photo.jpg', alt: 'No manifest' } })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(243, 244, 246)')
  })
})

describe('VImage — per-source placeholders (art direction)', () => {
  const BLURHASH_A = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'
  const BLURHASH_B = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'
  const breakpoints = { tablet: '(max-width: 1024px)' }
  let matching: Set<string>

  beforeEach(() => {
    matching = new Set()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media: string) => ({
        media,
        get matches() {
          return matching.has(media)
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  })

  function mountArt(props: Record<string, unknown>, placeholders?: PlaceholderManifest) {
    return mount(VImage, {
      props: { src: '/vertical.jpg', alt: 'Art', width: 300, height: 400, ...props },
      global: {
        provide: {
          [BREAKPOINTS_KEY as symbol]: breakpoints,
          ...(placeholders ? { [PLACEHOLDERS_KEY as symbol]: placeholders } : {}),
        },
      },
    })
  }

  it('uses the root placeholder when no source matches', async () => {
    const wrapper = mountArt({
      blurhash: BLURHASH_A,
      sources: {
        tablet: { src: '/horizontal.jpg', width: 800, height: 400, blurhash: BLURHASH_B },
      },
    })
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('aspect-ratio: 300 / 400')
    expect(placeholderStyle(wrapper)).toContain('background-image')
  })

  it('switches to the matching source’s blurhash and proportions', async () => {
    matching.add(breakpoints.tablet)
    const wrapper = mountArt({
      blurhash: BLURHASH_A,
      sources: {
        tablet: { src: '/horizontal.jpg', width: 800, height: 400, blurhash: BLURHASH_B },
      },
    })
    await nextTick()
    await nextTick()
    const style = placeholderStyle(wrapper)
    expect(style).toContain('aspect-ratio: 800 / 400')
    expect(style).toContain('background-image')

    const rootOnly = mountArt({ blurhash: BLURHASH_B, width: 800, height: 400 })
    await nextTick()
    expect(style).toBe(placeholderStyle(rootOnly))
    const otherHash = mountArt({ blurhash: BLURHASH_A, width: 800, height: 400 })
    await nextTick()
    expect(style).not.toBe(placeholderStyle(otherHash))
  })

  it('replaces the whole root placeholder set — a root placeholderColor no longer wins over the source blurhash', async () => {
    matching.add(breakpoints.tablet)
    const wrapper = mountArt({
      placeholderColor: '#201d1f',
      sources: {
        tablet: { src: '/horizontal.jpg', width: 800, height: 400, blurhash: BLURHASH_B },
      },
    })
    await nextTick()
    await nextTick()
    const style = placeholderStyle(wrapper)
    expect(style).not.toContain('background-color: rgb(32, 29, 31)')
    expect(style).toContain('background-image')
  })

  it('applies a source-level placeholderColor even without dimensions', async () => {
    matching.add(breakpoints.tablet)
    const wrapper = mountArt({
      blurhash: BLURHASH_A,
      sources: { tablet: { src: '/horizontal.jpg', placeholderColor: '#336699' } },
    })
    await nextTick()
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(51, 102, 153)')
  })

  it('takes the active source’s entry from the placeholders manifest by its src', async () => {
    matching.add(breakpoints.tablet)
    const manifest: PlaceholderManifest = {
      '/vertical.jpg': { blurhash: BLURHASH_A, width: 300, height: 400 },
      '/horizontal.jpg': { blurhash: BLURHASH_B, width: 800, height: 400 },
    }
    const wrapper = mountArt(
      { width: undefined, height: undefined, sources: { tablet: '/horizontal.jpg' } },
      manifest,
    )
    await nextTick()
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('aspect-ratio: 800 / 400')
  })

  it('lets an explicit source field win over the manifest entry for the same source', async () => {
    matching.add(breakpoints.tablet)
    const manifest: PlaceholderManifest = {
      '/horizontal.jpg': { blurhash: BLURHASH_B, color: '#abcdef', width: 800, height: 400 },
    }
    const wrapper = mountArt(
      { sources: { tablet: { src: '/horizontal.jpg', placeholderColor: '#336699' } } },
      manifest,
    )
    await nextTick()
    await nextTick()
    expect(placeholderStyle(wrapper)).toContain('background-color: rgb(51, 102, 153)')
  })
})
