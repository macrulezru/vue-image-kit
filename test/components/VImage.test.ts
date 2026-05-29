import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VImage from '../../src/components/VImage.vue'
import { BREAKPOINTS_KEY } from '../../src/composables/useBreakpoints'

type IOCallback = (entries: IntersectionObserverEntry[]) => void

let ioCallback: IOCallback | null = null

beforeEach(() => {
  ioCallback = null
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IOCallback) => {
      ioCallback = cb
      return { observe: vi.fn(), disconnect: vi.fn() }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function triggerIntersect(): void {
  ioCallback?.([{ isIntersecting: true } as IntersectionObserverEntry])
}

describe('VImage', () => {
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

  it('renders LQIP placeholder img when placeholder prop provided', () => {
    const b64 = 'data:image/jpeg;base64,/9j/4AAQ=='
    const wrapper = mount(VImage, {
      props: { src: '/img.jpg', alt: 'Test', placeholder: b64 },
    })
    const placeholderImg = wrapper.find('img[aria-hidden="true"]')
    expect(placeholderImg.exists()).toBe(true)
    expect(placeholderImg.attributes('src')).toBe(b64)
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

    it('also applies object-position to the placeholder so it aligns', () => {
      const wrapper = mount(VImage, {
        props: {
          src: '/img.jpg',
          alt: 'Test',
          placeholder: 'data:image/jpeg;base64,/9j/4AAQ==',
          focal: { x: 0.25, y: 0.75 },
        },
      })
      const placeholder = wrapper.find('img[aria-hidden="true"]')
      expect(placeholder.attributes('style')).toContain('object-position: 25% 75%')
    })
  })

  describe('color placeholder', () => {
    // KNOWN_HASH average → rgba(150, 146, 104, 1.000)
    const THUMBHASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

    function colorSpan(wrapper: ReturnType<typeof mount>) {
      return wrapper
        .findAll('span[aria-hidden="true"]')
        .find((s) => (s.attributes('style') ?? '').includes('background-color'))
    }

    it('renders a solid background-color span from an explicit placeholderColor', () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', placeholderColor: 'rgb(10, 20, 30)' },
      })
      const span = colorSpan(wrapper)
      expect(span).toBeDefined()
      expect(span!.attributes('style')).toContain('background-color: rgb(10, 20, 30)')
    })

    it('derives the average color from thumbhash in placeholderMode="color"', () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', thumbhash: THUMBHASH, placeholderMode: 'color' },
      })
      const span = colorSpan(wrapper)
      expect(span).toBeDefined()
      // jsdom normalises rgba(…, 1.000) to rgb(…)
      expect(span!.attributes('style')).toContain('background-color: rgb(150, 146, 104)')
    })

    it('suppresses the blur placeholder img and canvas in color mode', () => {
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
      // No decoded ThumbHash/LQIP <img> and no blurhash <canvas>
      expect(wrapper.find('img[aria-hidden="true"]').exists()).toBe(false)
      expect(wrapper.find('canvas').exists()).toBe(false)
      expect(colorSpan(wrapper)).toBeDefined()
    })

    it('does not render a color span without color settings', () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', thumbhash: THUMBHASH },
      })
      // Default mode is blur → ThumbHash is decoded to an <img>, not a color span
      expect(colorSpan(wrapper)).toBeUndefined()
      expect(wrapper.find('img[aria-hidden="true"]').exists()).toBe(true)
    })
  })

  describe('shimmer placeholder', () => {
    it('renders an animated shimmer span in placeholderMode="shimmer"', () => {
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
      expect(wrapper.find('.vik-shimmer').exists()).toBe(true)
      // shimmer suppresses the blur canvas and any placeholder img
      expect(wrapper.find('canvas').exists()).toBe(false)
      expect(wrapper.find('img[aria-hidden="true"]').exists()).toBe(false)
    })

    it('does not render shimmer in the default (blur) mode', () => {
      const wrapper = mount(VImage, { props: { src: '/img.jpg', alt: 'Test' } })
      expect(wrapper.find('.vik-shimmer').exists()).toBe(false)
    })

    it('hides the shimmer (opacity 0) once the image has loaded', async () => {
      const wrapper = mount(VImage, {
        props: { src: '/img.jpg', alt: 'Test', placeholderMode: 'shimmer', lazy: false },
      })
      await nextTick()
      triggerIntersect()
      await nextTick()
      const img = wrapper.find('img:not([aria-hidden])')
      await img.trigger('load')
      await nextTick()
      expect(wrapper.find('.vik-shimmer').attributes('style')).toContain('opacity: 0')
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

    it('renders no <source media> when sources prop is empty object', async () => {
      const wrapper = await mountWithSources({ sources: {} })
      expect(wrapper.findAll('source[media]')).toHaveLength(0)
    })
  })
})
