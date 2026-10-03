import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VImage from '../../src/components/VImage.vue'
import { registerPlaceholder, lookupRegisteredPlaceholder } from '../../src/utils/placeholder-registry'
import { lookupManifestEntry } from '../../src/utils/manifest-placeholder'
import { PLACEHOLDERS_KEY } from '../../src/utils/placeholders'
import { clearObserverPool } from '../../src/utils/observer-pool'

type IOCallback = (entries: IntersectionObserverEntry[]) => void
let ioCallback: IOCallback | null = null

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

describe('registerPlaceholder', () => {
  it('stores the entry under the given src, accepting the prop-style color name', () => {
    registerPlaceholder('/_nuxt/a.abc123.webp', {
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      placeholderColor: '#123456',
      width: 80,
      height: 40,
    })
    expect(lookupRegisteredPlaceholder('/_nuxt/a.abc123.webp')).toEqual({
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      color: '#123456',
      width: 80,
      height: 40,
    })
  })

  it('ignores an empty source and an entry with nothing in it', () => {
    registerPlaceholder('', { blurhash: 'x' })
    registerPlaceholder('/_nuxt/empty.png', {})
    expect(lookupRegisteredPlaceholder('')).toBeUndefined()
    expect(lookupRegisteredPlaceholder('/_nuxt/empty.png')).toBeUndefined()
  })

  it('drops a size when only one side is known', () => {
    registerPlaceholder('/_nuxt/half.png', { color: '#000000', width: 10 })
    expect(lookupRegisteredPlaceholder('/_nuxt/half.png')).toEqual({ color: '#000000' })
  })
})

describe('lookupManifestEntry with the registry', () => {
  it('falls back to the registry when there is no manifest at all', () => {
    registerPlaceholder('/_nuxt/b.png', { color: '#abcdef' })
    expect(lookupManifestEntry(null, '/_nuxt/b.png')).toEqual({ color: '#abcdef' })
  })

  it('prefers the manifest entry over the registered one', () => {
    registerPlaceholder('/_nuxt/c.png', { color: '#111111' })
    expect(lookupManifestEntry({ '/_nuxt/c.png': { color: '#222222' } }, '/_nuxt/c.png')).toEqual({
      color: '#222222',
    })
  })

  it('returns nothing for an unknown or missing src', () => {
    expect(lookupManifestEntry(null, '/_nuxt/unknown.png')).toBeUndefined()
    expect(lookupManifestEntry({}, undefined)).toBeUndefined()
  })
})

describe('VImage with a registered placeholder and no manifest', () => {
  it('fills the blur and the size from the registry', async () => {
    registerPlaceholder('/_nuxt/hero.hash1.webp', {
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      color: '#123456',
      width: 800,
      height: 600,
    })
    const wrapper = mount(VImage, { props: { src: '/_nuxt/hero.hash1.webp', alt: 'Hero' } })
    await nextTick()
    const style = wrapper.find('span[aria-hidden="true"]').attributes('style') ?? ''
    expect(style).toContain('background-image: url("data:image/png;base64,MOCK')
    expect(style).toContain('aspect-ratio: 800 / 600')
  })

  it('puts the registered size on the real image once it loads', async () => {
    registerPlaceholder('/_nuxt/size.hash2.webp', { color: '#123456', width: 800, height: 600 })
    const wrapper = mount(VImage, { props: { src: '/_nuxt/size.hash2.webp', alt: 'Size', lazy: false } })
    await nextTick()
    ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
    await nextTick()
    await nextTick()
    const img = wrapper.find('img:not([aria-hidden])')
    expect(img.attributes('width')).toBe('800')
    expect(img.attributes('height')).toBe('600')
  })

  it('still lets an explicit width win over the registered size', async () => {
    registerPlaceholder('/_nuxt/wide.png', { color: '#123456', width: 800, height: 600 })
    const wrapper = mount(VImage, {
      props: { src: '/_nuxt/wide.png', alt: 'Wide', width: 400, height: 300, lazy: false },
    })
    await nextTick()
    ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
    await nextTick()
    await nextTick()
    expect(wrapper.find('img:not([aria-hidden])').attributes('width')).toBe('400')
  })

  it('works the same with an unrelated manifest provided', async () => {
    registerPlaceholder('/_nuxt/mix.png', { color: '#654321', width: 200, height: 100 })
    const wrapper = mount(VImage, {
      props: { src: '/_nuxt/mix.png', alt: 'Mix' },
      global: { provide: { [PLACEHOLDERS_KEY as symbol]: { '/other.png': { color: '#000000' } } } },
    })
    await nextTick()
    expect(wrapper.find('span[aria-hidden="true"]').attributes('style') ?? '').toContain(
      'aspect-ratio: 200 / 100',
    )
  })
})
