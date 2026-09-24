import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VImage from '../../src/components/VImage.vue'
import { BREAKPOINTS_KEY } from '../../src/composables/useBreakpoints'
import { netlify } from '../../src/cdn'
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearObserverPool()
})

function triggerIntersect(): void {
  ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
}

describe('VImage', () => {
  describe('attrs fallthrough (no wrapper element)', () => {
    it('applies to the idle placeholder before loading starts', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test' },
        attrs: { 'data-testid': 'my-image', class: 'custom-class' },
      })
      await nextTick()
      const el = wrapper.find('[data-testid="my-image"]')
      expect(el.exists()).toBe(true)
      expect(el.element.tagName).toBe('SPAN')
      expect(el.classes()).toContain('custom-class')
    })

    it('applies to the real <img> once it starts rendering', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', lazy: false },
        attrs: { 'data-testid': 'my-image', class: 'custom-class' },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      const el = wrapper.find('[data-testid="my-image"]')
      expect(el.exists()).toBe(true)
      expect(el.element.tagName).toBe('IMG')
      expect(el.classes()).toContain('custom-class')
    })
  })

  it('renders without error with required props', () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test image' },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('sets alt attribute on img', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'My photo', lazy: false },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const img = wrapper.find('img:not([aria-hidden])')
    expect(img.attributes('alt')).toBe('My photo')
  })

  it('renders picture with AVIF source when src has avif', async () => {
    const wrapper = mount(VImage, {
      props: {
        src: { avif: '/img.avif', webp: '/img.webp', fallback: '/img.jpg' },
        alt: 'Test',
        lazy: false,
      },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const sources = wrapper.findAll('source')
    const avifSource = sources.find((s) => s.attributes('type') === 'image/avif')
    const webpSource = sources.find((s) => s.attributes('type') === 'image/webp')

    expect(avifSource).toBeDefined()
    expect(avifSource?.attributes('srcset')).toBe('/img.avif')
    expect(webpSource).toBeDefined()
    expect(webpSource?.attributes('srcset')).toBe('/img.webp')
  })

  it('renders picture without source elements when src is a string', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', lazy: false },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const sources = wrapper.findAll('source')
    expect(sources.length).toBe(0)
  })

  it('shows custom error slot on error', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', lazy: false },
      slots: {
        error: '<div class="custom-error">Failed!</div>',
      },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const img = wrapper.find('img:not([aria-hidden])')
    await img.trigger('error')
    await nextTick()

    expect(wrapper.find('.custom-error').exists()).toBe(true)
  })

  it('shows default error fallback (svg) when no error slot', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', lazy: false },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const img = wrapper.find('img:not([aria-hidden])')
    await img.trigger('error')
    await nextTick()

    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('emits @load event when image loads', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', lazy: false },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const img = wrapper.find('img:not([aria-hidden])')
    await img.trigger('load')
    await nextTick()

    expect(wrapper.emitted('load')).toBeTruthy()
  })

  it('emits @error event when image fails', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', lazy: false },
    })
    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    const img = wrapper.find('img:not([aria-hidden])')
    await img.trigger('error')
    await nextTick()

    expect(wrapper.emitted('error')).toBeTruthy()
  })

  it('renders LQIP placeholder as a background-image on the idle span', async () => {
    const b64 = 'data:image/jpeg;base64,/9j/4AAQ=='
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', placeholder: b64 },
    })
    await nextTick()
    const span = wrapper.find('span[aria-hidden="true"]')
    expect(span.exists()).toBe(true)
    expect(span.attributes('style')).toContain(`background-image: url("${b64}")`)
  })

  describe('density descriptors', () => {
    async function mountLoaded(props: Record<string, unknown>) {
      const wrapper = mount(VImage, {
        props: { src: '/a.png', alt: 'Test', lazy: false, ...props },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('renders a repeated-file srcset from a density list', async () => {
      const wrapper = await mountLoaded({ densities: [1, 2, 3] })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('srcset')).toBe('/a.png 1x, /a.png 2x, /a.png 3x')
    })

    it('renders distinct files from a per-density URL map', async () => {
      const wrapper = await mountLoaded({
        densities: { 1: '/a.png', 2: '/a@2x.png', 3: '/a@3x.png' },
      })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('srcset')).toBe('/a.png 1x, /a@2x.png 2x, /a@3x.png 3x')
    })
  })

  describe('focal point (object-position)', () => {
    async function mountLoaded(props: Record<string, unknown> = {}) {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', lazy: false, ...props },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('omits object-position when focal is not set', async () => {
      const wrapper = await mountLoaded()
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('style')).not.toContain('object-position')
    })

    it('maps focal fractions to object-position percentages on the main img', async () => {
      const wrapper = await mountLoaded({ focal: { x: 0.5, y: 0.3 } })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('style')).toContain('object-position: 50% 30%')
    })

    it('clamps focal values to the 0–1 range', async () => {
      const wrapper = await mountLoaded({ focal: { x: 1.5, y: -0.2 } })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('style')).toContain('object-position: 100% 0%')
    })

    it('also applies the focal point to the placeholder background so it aligns', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          placeholder: 'data:image/jpeg;base64,/9j/4AAQ==',
          focal: { x: 0.25, y: 0.75 },
        },
      })
      await nextTick()
      const placeholder = wrapper.find('span[aria-hidden="true"]')
      expect(placeholder.attributes('style')).toContain('background-position: 25% 75%')
    })
  })

  describe('color placeholder', () => {
    const THUMBHASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

    function colorSpan(wrapper: ReturnType<typeof mount>) {
      return wrapper
        .findAll('span[aria-hidden="true"]')
        .find((s) => (s.attributes('style') ?? '').includes('background-color'))
    }

    it('renders a solid background-color span from an explicit placeholderColor', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', placeholderColor: 'rgb(10, 20, 30)' },
      })
      await nextTick()
      const span = colorSpan(wrapper)
      expect(span).toBeDefined()
      expect(span!.attributes('style')).toContain('background-color: rgb(10, 20, 30)')
    })

    it('derives the average color from thumbhash in placeholderMode="color"', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', thumbhash: THUMBHASH, placeholderMode: 'color' },
      })
      await nextTick()
      const span = colorSpan(wrapper)
      expect(span).toBeDefined()
      expect(span!.attributes('style')).toContain('background-color: rgb(150, 146, 104)')
    })

    it('suppresses the blur placeholder img and canvas in color mode', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          thumbhash: THUMBHASH,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          width: 100,
          height: 100,
          placeholderMode: 'color',
        },
      })
      await nextTick()
      expect(wrapper.find('img[aria-hidden="true"]').exists()).toBe(false)
      expect(wrapper.find('canvas').exists()).toBe(false)
      const span = colorSpan(wrapper)
      expect(span).toBeDefined()
      expect(span!.attributes('style')).not.toContain('background-image')
    })

    it('does not render a color span without color settings', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', thumbhash: THUMBHASH },
      })
      await nextTick()
      expect(colorSpan(wrapper)).toBeUndefined()
      const span = wrapper.find('span[aria-hidden="true"]')
      expect(span.attributes('style')).toContain('background-image: url("data:')
    })

    it('in blur mode, a real blurhash wins over a LQIP/ThumbHash placeholder instead of mounting both', async () => {
      const thumbhashOnly = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', thumbhash: THUMBHASH, width: 100, height: 100 },
      })
      const withBlurhash = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          thumbhash: THUMBHASH,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          width: 100,
          height: 100,
        },
      })
      await nextTick()
      const thumbhashOnlyStyle = thumbhashOnly.find('span[aria-hidden="true"]').attributes('style')
      const withBlurhashStyle = withBlurhash.find('span[aria-hidden="true"]').attributes('style')
      expect(thumbhashOnlyStyle).toContain('background-image: url("data:')
      expect(withBlurhashStyle).toContain('background-image: url("data:')
      expect(withBlurhashStyle).not.toBe(thumbhashOnlyStyle)
    })

    it('falls back to the LQIP/ThumbHash placeholder when blurhash cannot render (missing width/height)', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          thumbhash: THUMBHASH,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        },
      })
      await nextTick()
      const span = wrapper.find('span[aria-hidden="true"]')
      expect(span.attributes('style')).toContain('background-image: url("data:')
    })
  })

  describe('shimmer placeholder', () => {
    it('renders an animated shimmer span in placeholderMode="shimmer"', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          placeholderMode: 'shimmer',
          width: 100,
          height: 100,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        },
      })
      await nextTick()
      expect(wrapper.find('.vik-shimmer').exists()).toBe(true)
      expect(wrapper.find('canvas').exists()).toBe(false)
      expect(wrapper.find('img[aria-hidden="true"]').exists()).toBe(false)
    })

    it('does not render shimmer in the default (blur) mode', () => {
      const wrapper = mount(VImage, { props: { src: '/img.jpg', alt: 'Test' } })
      expect(wrapper.find('.vik-shimmer').exists()).toBe(false)
    })

    it('removes the shimmer class once the image has loaded', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', placeholderMode: 'shimmer', lazy: false },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).toContain('vik-shimmer')
      await img.trigger('load')
      await nextTick()
      expect(wrapper.find('img:not([aria-hidden])').classes()).not.toContain('vik-shimmer')
    })
  })

  describe('responsive sources (art direction)', () => {
    const globalBreakpoints = {
      sm: '(max-width: 640px)',
      md: '(max-width: 1024px)',
    }

    async function mountWithSources(props: Record<string, unknown> = {}) {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', lazy: false, ...props },
        global: {
          provide: { [BREAKPOINTS_KEY as symbol]: globalBreakpoints },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('renders <source media> elements from global breakpoints + sources prop', async () => {
      const wrapper = await mountWithSources({
        sources: { sm: '/img-sm.jpg', md: '/img-md.jpg' },
      })
      const sources = wrapper.findAll('source[media]')
      expect(sources).toHaveLength(2)
      expect(sources[0].attributes('media')).toBe('(max-width: 640px)')
      expect(sources[0].attributes('srcset')).toBe('/img-sm.jpg')
      expect(sources[1].attributes('media')).toBe('(max-width: 1024px)')
      expect(sources[1].attributes('srcset')).toBe('/img-md.jpg')
    })

    it('sorts <source media> ascending by max-width (narrower first)', async () => {
      const wrapper = await mountWithSources({
        sources: { md: '/img-md.jpg', sm: '/img-sm.jpg' },
      })
      const sources = wrapper.findAll('source[media]')
      expect(sources[0].attributes('media')).toBe('(max-width: 640px)')
      expect(sources[1].attributes('media')).toBe('(max-width: 1024px)')
    })

    it('merges local breakpoints with global ones', async () => {
      const wrapper = await mountWithSources({
        breakpoints: { xl: '(min-width: 1440px)' },
        sources: { sm: '/img-sm.jpg', xl: '/img-xl.jpg' },
      })
      const sources = wrapper.findAll('source[media]')
      const medias = sources.map(s => s.attributes('media'))
      expect(medias).toContain('(max-width: 640px)')
      expect(medias).toContain('(min-width: 1440px)')
    })

    it('local breakpoints override global breakpoints with same key', async () => {
      const wrapper = await mountWithSources({
        breakpoints: { sm: '(max-width: 480px)' },
        sources: { sm: '/img-sm.jpg' },
      })
      const source = wrapper.find('source[media]')
      expect(source.attributes('media')).toBe('(max-width: 480px)')
    })

    it('skips source keys not present in any breakpoint map', async () => {
      const wrapper = await mountWithSources({
        sources: { sm: '/img-sm.jpg', unknown: '/img-unknown.jpg' },
      })
      const sources = wrapper.findAll('source[media]')
      expect(sources).toHaveLength(1)
      expect(sources[0].attributes('srcset')).toBe('/img-sm.jpg')
    })

    it('renders <picture> when only sources provided (no SrcSet format object)', async () => {
      const wrapper = await mountWithSources({
        sources: { sm: '/img-sm.jpg' },
      })
      expect(wrapper.find('picture').exists()).toBe(true)
    })

    it('renders plain <img> when no sources and no SrcSet format object', async () => {
      const wrapper = await mountWithSources({})
      expect(wrapper.find('picture').exists()).toBe(false)
      expect(wrapper.find('img:not([aria-hidden])').exists()).toBe(true)
    })

    it('combines media sources with AVIF/WebP format sources', async () => {
      const wrapper = await mountWithSources({
        src: { avif: '/img.avif', webp: '/img.webp', fallback: '/img.jpg' },
        sources: { sm: '/img-sm.jpg' },
      })
      const mediaSources = wrapper.findAll('source[media]')
      const typeSources  = wrapper.findAll('source[type]')
      expect(mediaSources).toHaveLength(1)
      expect(typeSources).toHaveLength(2)
    })

    it('renders avif/webp/fallback sources for a single art-directed breakpoint', async () => {
      const wrapper = await mountWithSources({
        sources: { sm: { avif: '/sm.avif', webp: '/sm.webp', fallback: '/sm.jpg' } },
      })
      const sources = wrapper.findAll('source[media]')
      expect(sources).toHaveLength(3)
      expect(sources[0].attributes('media')).toBe('(max-width: 640px)')
      expect(sources[0].attributes('type')).toBe('image/avif')
      expect(sources[0].attributes('srcset')).toBe('/sm.avif')
      expect(sources[1].attributes('type')).toBe('image/webp')
      expect(sources[1].attributes('srcset')).toBe('/sm.webp')
      expect(sources[2].attributes('type')).toBeUndefined()
      expect(sources[2].attributes('srcset')).toBe('/sm.jpg')
    })

    it('renders no <source media> when sources prop is empty object', async () => {
      const wrapper = await mountWithSources({ sources: {} })
      expect(wrapper.findAll('source[media]')).toHaveLength(0)
    })
  })

  describe('image prop (build-time metadata)', () => {
    it('seeds src/width/height/blurhash/placeholder from image when no explicit props given', async () => {
      const wrapper = mount(VImage, {
        props: {
          alt: 'From manifest',
          lazy: false,
          image: {
            src: '/manifest.jpg',
            width: 640,
            height: 480,
            placeholder: 'data:image/jpeg;base64,AAA',
          },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('src')).toBe('/manifest.jpg')
      expect(img.attributes('width')).toBe('640')
      expect(img.attributes('height')).toBe('480')
    })

    it('lets an explicit prop override the matching image field', async () => {
      const wrapper = mount(VImage, {
        props: {
          alt: 'Override',
          lazy: false,
          src: '/explicit.jpg',
          image: { src: '/manifest.jpg', width: 640, height: 480 },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('img:not([aria-hidden])').attributes('src')).toBe('/explicit.jpg')
    })

    it('renders <picture> with AVIF/WebP sources when image has webp/avif', async () => {
      const wrapper = mount(VImage, {
        props: {
          alt: 'Formats',
          lazy: false,
          image: { src: '/manifest.jpg', webp: '/manifest.webp', avif: '/manifest.avif' },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('source[type="image/avif"]').attributes('srcset')).toBe('/manifest.avif')
      expect(wrapper.find('source[type="image/webp"]').attributes('srcset')).toBe('/manifest.webp')
    })

    it('uses image.srcset as-is when widths is not given', async () => {
      const wrapper = mount(VImage, {
        props: {
          alt: 'Raw srcset',
          lazy: false,
          image: { src: '/manifest.jpg', srcset: '/manifest-400.jpg 400w, /manifest-800.jpg 800w' },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('img:not([aria-hidden])').attributes('srcset'))
        .toBe('/manifest-400.jpg 400w, /manifest-800.jpg 800w')
    })
  })

  describe('priority prop', () => {
    it('forces eager loading, fetchpriority=high and decoding=sync', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/hero.jpg', alt: 'Hero', priority: true },
      })
      await nextTick()
      await nextTick()

      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('fetchpriority')).toBe('high')
      expect(img.attributes('decoding')).toBe('sync')
    })

    it('does not register an IntersectionObserver when priority is set', () => {
      const observeSpy = vi.fn()
      vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: observeSpy, disconnect: vi.fn() })))

      mount(VImage, {
        props: { src: '/hero.jpg', alt: 'Hero', priority: true },
      })

      expect(observeSpy).not.toHaveBeenCalled()
    })
  })

  describe('respectSaveData prop', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true })
    })

    it('has no effect when saveData is off', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: false }, configurable: true })

      const observeSpy = vi.fn()
      vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: observeSpy, disconnect: vi.fn() })))

      mount(VImage, {
        props: { src: '/hero.jpg', alt: 'Hero', priority: true, respectSaveData: true },
      })

      expect(observeSpy).not.toHaveBeenCalled()
    })

    it('neutralizes priority (stays lazy) when saveData is on', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })

      const observeSpy = vi.fn()
      vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: observeSpy, disconnect: vi.fn() })))

      mount(VImage, {
        props: { src: '/hero.jpg', alt: 'Hero', priority: true, respectSaveData: true },
      })
      await nextTick()

      expect(observeSpy).toHaveBeenCalled()
    })

    it('downgrades to the smallest density URL when saveData is on', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })

      const wrapper = mount(VImage, {
        props: {
          src: '/full.jpg',
          alt: 'Downgraded',
          lazy: false,
          respectSaveData: true,
          densities: { 1: '/small.jpg', 2: '/large@2x.jpg' },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('src')).toBe('/small.jpg')
      expect(img.attributes('srcset')).toBeUndefined()
    })

    it('downgrades to the smallest image.srcset URL when saveData is on', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })

      const wrapper = mount(VImage, {
        props: {
          alt: 'Downgraded from manifest',
          lazy: false,
          respectSaveData: true,
          image: { src: '/full.jpg', srcset: '/small-400.jpg 400w, /full-1200.jpg 1200w' },
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('src')).toBe('/small-400.jpg')
      expect(img.attributes('srcset')).toBeUndefined()
    })

    it('does not leave densities on the rendered img when saveData is on, even with widths also set', async () => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })

      const wrapper = mount(VImage, {
        props: {
          src: '/full.jpg',
          alt: 'Downgraded',
          lazy: false,
          respectSaveData: true,
          densities: { 1: '/small.jpg', 2: '/large@2x.jpg', 3: '/huge@3x.jpg' },
          widths: [400, 800],
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.attributes('src')).toBe('/small.jpg')
      expect(img.attributes('src')).not.toContain('@2x')
      expect(img.attributes('src')).not.toContain('@3x')
      expect(img.attributes('srcset')).not.toContain('@2x')
      expect(img.attributes('srcset')).not.toContain('@3x')
      expect(img.attributes('srcset')).toBe('/small.jpg 400w, /small.jpg 800w')
    })
  })

  describe('layout prop', () => {
    it('defaults to filling the container with aspect-ratio', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Default', width: 800, height: 400 },
      })
      await nextTick()
      const style = wrapper.find('span').element.style
      expect(style.position).toBe('')
      expect(style.width).toBe('100%')
      expect(style.aspectRatio).toBe('800 / 400')
    })

    it('does not force width: 100% on the idle placeholder when width/height are not given either', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'No dimensions' },
      })
      await nextTick()
      const style = wrapper.find('span').element.style
      expect(style.width).toBe('')
      expect(style.height).toBe('')
      expect(style.display).toBe('block')
    })

    it('fixed: sizes the wrapper to an exact width/height box', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Fixed', width: 300, height: 150, layout: 'fixed' },
      })
      await nextTick()
      const style = wrapper.find('span').element.style
      expect(style.width).toBe('300px')
      expect(style.height).toBe('150px')
      expect(style.display).toBe('inline-block')
    })

    it('fill: absolutely fills the parent, ignoring width/height for sizing', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Fill', layout: 'fill' },
      })
      await nextTick()
      const style = wrapper.find('span').element.style
      expect(style.position).toBe('absolute')
      expect(style.inset).toBe('0')
      expect(style.width).toBe('100%')
      expect(style.height).toBe('100%')
    })

    it('responsive: auto-generates sizes from width when sizes is not given', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg', alt: 'Responsive', width: 640, height: 320,
          widths: [320, 640, 960], layout: 'responsive', lazy: false,
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('img:not([aria-hidden])').attributes('sizes')).toBe('(min-width: 640px) 640px, 100vw')
    })

    it('responsive: explicit sizes prop wins over the auto-generated one', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg', alt: 'Responsive', width: 640, height: 320,
          widths: [320, 640, 960], layout: 'responsive', sizes: '50vw', lazy: false,
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('img:not([aria-hidden])').attributes('sizes')).toBe('50vw')
    })

    it('unset layout auto-generates sizes too — visually identical to "responsive", so it gets the same heuristic', async () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg', alt: 'No layout', width: 640, height: 320,
          widths: [320, 640, 960], lazy: false,
        },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()

      expect(wrapper.find('img:not([aria-hidden])').attributes('sizes')).toBe('(min-width: 640px) 640px, 100vw')
    })

    it('does not auto-generate sizes for layout="fixed"/"fill"', async () => {
      for (const layout of ['fixed', 'fill'] as const) {
        const wrapper = mount(VImage, {
          props: {
            src: '/img.jpg', alt: 'Fixed or fill', width: 640, height: 320,
            widths: [320, 640, 960], layout, lazy: false,
          },
        })
        await nextTick()
        triggerIntersect()
        await nextTick()
        await nextTick()

        expect(wrapper.find('img:not([aria-hidden])').attributes('sizes')).toBe('100vw')
      }
    })
  })

  describe('default box/object-fit styling', () => {
    async function mountLoaded(props: Record<string, unknown> = {}) {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', lazy: false, ...props },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('applies only the base box class, no sizing/fit classes or inline styles, when neither width/height nor layout is given', async () => {
      const wrapper = await mountLoaded()
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).toContain('vik-box')
      expect(img.classes()).not.toContain('vik-box--responsive')
      expect(img.classes()).not.toContain('vik-fit')
      expect(img.attributes('style')).not.toContain('object-fit')
      expect(img.attributes('style')).not.toContain('width')
      expect(img.attributes('style')).not.toContain('display')
    })

    it('applies the vik-fit class (not an inline style) when width/height make object-fit meaningful', async () => {
      const wrapper = await mountLoaded({ width: 400, height: 300 })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).toContain('vik-fit')
      expect(img.attributes('style')).not.toContain('object-fit')
    })

    it('always sets object-fit inline when fit is passed explicitly, and skips the vik-fit class', async () => {
      const wrapper = await mountLoaded({ width: 400, height: 300, fit: 'contain' })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).not.toContain('vik-fit')
      expect(img.attributes('style')).toContain('object-fit: contain')
    })

    it('layout="fill": uses the vik-box--fill class and the vik-fit class, no fixed-size inline style', async () => {
      const wrapper = await mountLoaded({ layout: 'fill' })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).toContain('vik-box--fill')
      expect(img.classes()).toContain('vik-fit')
      expect(img.attributes('style')).not.toContain('width')
    })

    it('layout="fixed": uses the vik-box--fixed class plus an inline pixel width/height', async () => {
      const wrapper = await mountLoaded({ layout: 'fixed', width: 300, height: 150 })
      const img = wrapper.find('img:not([aria-hidden])')
      expect(img.classes()).toContain('vik-box--fixed')
      expect(img.classes()).toContain('vik-fit')
      expect(img.attributes('style')).toContain('width: 300px')
      expect(img.attributes('style')).toContain('height: 150px')
    })

    it('error state combines the base box classes with vik-box--error', async () => {
      const wrapper = await mountLoaded({ src: '/broken.jpg', width: 400, height: 300 })
      await wrapper.find('img:not([aria-hidden])').trigger('error')
      await nextTick()
      const span = wrapper.find('span')
      expect(span.classes()).toContain('vik-box')
      expect(span.classes()).toContain('vik-box--responsive')
      expect(span.classes()).toContain('vik-box--error')
    })

    it('does not force width/height sizing on the error box either, when neither width/height nor layout is given', async () => {
      const wrapper = await mountLoaded({ src: '/broken.jpg' })
      await wrapper.find('img:not([aria-hidden])').trigger('error')
      await nextTick()
      const span = wrapper.find('span')
      expect(span.classes()).not.toContain('vik-box--responsive')
      expect(span.classes()).toContain('vik-box--error')
    })
  })

  describe('dev-mode alt warning', () => {
    it('warns when alt looks like a filename', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(VImage, { props: { src: '/img.jpg', alt: 'photo1.jpg' } })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('filename'))
      warnSpy.mockRestore()
    })

    it('warns when alt is whitespace-only', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(VImage, { props: { src: '/img.jpg', alt: '   ' } })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('whitespace-only'))
      warnSpy.mockRestore()
    })

    it('does not warn for real descriptive alt text', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(VImage, { props: { src: '/img.jpg', alt: 'A sunset over the mountains' } })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('does not warn for a deliberate empty (decorative) alt', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mount(VImage, { props: { src: '/img.jpg', alt: '' } })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('cdn prop', () => {
    async function mountCdn(props: Record<string, unknown>) {
      const wrapper = mount(VImage, { props: { alt: 'Test', lazy: false, ...props } })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('has no effect when unset (default behavior unchanged)', async () => {
      const wrapper = await mountCdn({ src: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' })
      expect(wrapper.find('img:not([aria-hidden])').attributes('src'))
        .toBe('https://res.cloudinary.com/demo/image/upload/photo.jpg')
    })

    it('rewrites a recognized CDN URL when cdn is true', async () => {
      const wrapper = await mountCdn({ src: 'https://res.cloudinary.com/demo/image/upload/photo.jpg', cdn: true })
      const src = wrapper.find('img:not([aria-hidden])').attributes('src')
      expect(src).toContain('res.cloudinary.com/demo/')
      expect(src).not.toBe('https://res.cloudinary.com/demo/image/upload/photo.jpg')
    })

    it('passes an unrecognized host through unchanged', async () => {
      const wrapper = await mountCdn({ src: 'https://example.com/photo.jpg', cdn: true })
      expect(wrapper.find('img:not([aria-hidden])').attributes('src')).toBe('https://example.com/photo.jpg')
    })

    it('builds a real per-width srcset via the CDN adapter when combined with widths', async () => {
      const wrapper = await mountCdn({
        src: 'https://mysite.imgix.net/photo.jpg',
        cdn: true,
        widths: [400, 800],
      })
      const srcset = wrapper.find('img:not([aria-hidden])').attributes('srcset')
      expect(srcset).toContain('w=400')
      expect(srcset).toContain('w=800')
      expect(srcset).toContain('mysite.imgix.net')
    })

    it('accepts a config object for own-domain providers via cdn.hosts', async () => {
      const wrapper = await mountCdn({
        src: 'https://myapp.netlify.app/photo.jpg',
        cdn: { hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) } },
      })
      expect(wrapper.find('img:not([aria-hidden])').attributes('src')).toContain('/.netlify/images')
    })

    it('does not apply to an explicit SrcSet object src', async () => {
      const wrapper = await mountCdn({
        src: { avif: '/img.avif', webp: '/img.webp', fallback: 'https://res.cloudinary.com/demo/image/upload/photo.jpg' },
        cdn: true,
      })
      expect(wrapper.find('source[type="image/avif"]').attributes('srcset')).toBe('/img.avif')
    })
  })

  describe('loader="server" prop', () => {
    async function mountLoader(props: Record<string, unknown>) {
      const wrapper = mount(VImage, { props: { alt: 'Test', lazy: false, ...props } })
      await nextTick()
      triggerIntersect()
      await nextTick()
      await nextTick()
      return wrapper
    }

    it('has no effect when unset', async () => {
      const wrapper = await mountLoader({ src: '/photos/cat.jpg' })
      expect(wrapper.find('img:not([aria-hidden])').attributes('src')).toBe('/photos/cat.jpg')
    })

    it('rewrites src through buildImageUrl at the default route', async () => {
      const wrapper = await mountLoader({ src: '/photos/cat.jpg', loader: 'server' })
      const src = wrapper.find('img:not([aria-hidden])').attributes('src')
      expect(src).toBe('/_vik/image?src=%2Fphotos%2Fcat.jpg')
    })

    it('loaderRoute overrides the default route', async () => {
      const wrapper = await mountLoader({ src: '/photos/cat.jpg', loader: 'server', loaderRoute: '/api/img' })
      const src = wrapper.find('img:not([aria-hidden])').attributes('src')
      expect(src).toBe('/api/img?src=%2Fphotos%2Fcat.jpg')
    })

    it('builds a real per-width srcset when combined with widths', async () => {
      const wrapper = await mountLoader({
        src: '/photos/cat.jpg', loader: 'server', widths: [400, 800],
      })
      const srcset = wrapper.find('img:not([aria-hidden])').attributes('srcset')
      expect(srcset).toContain('w=400')
      expect(srcset).toContain('w=800')
      expect(srcset).toContain('400w')
      expect(srcset).toContain('800w')
    })

    it('defers to cdn when both cdn and loader="server" are set', async () => {
      const wrapper = await mountLoader({
        src: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
        loader: 'server',
        cdn: true,
      })
      const src = wrapper.find('img:not([aria-hidden])').attributes('src')
      expect(src).toContain('res.cloudinary.com')
      expect(src).not.toContain('/_vik/image')
    })
  })
})
