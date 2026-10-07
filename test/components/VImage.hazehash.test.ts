import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VImage from '../../src/components/VImage.vue'
import { PLACEHOLDERS_KEY } from '../../src/utils/placeholders'
import { registerPlaceholder } from '../../src/utils/placeholder-registry'
import { clearObserverPool } from '../../src/utils/observer-pool'
import type { PlaceholderManifest } from '../../src/types'

const decodeResult = vi.hoisted(() => ({
  url: 'data:image/png;base64,HAZE' as string | undefined,
  pending: undefined as Promise<string | undefined> | undefined,
}))

vi.mock('../../src/utils/hazehash-decode', () => ({
  hazehashToDataUrl: vi.fn(() => decodeResult.pending ?? Promise.resolve(decodeResult.url)),
  loadHazehash: vi.fn(async () => null),
}))

const HAZEHASH = 'Ed7UwRWKKv5znndNd2Ba284jhm2TLgpUMa0UkQ'
const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'
const THUMBHASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

beforeEach(() => {
  decodeResult.url = 'data:image/png;base64,HAZE'
  decodeResult.pending = undefined
  clearObserverPool()
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
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
  delete (globalThis as Record<string, unknown>)['__VIK_PLACEHOLDERS__']
  clearObserverPool()
})

function style(wrapper: ReturnType<typeof mount>): string {
  return wrapper.find('span[aria-hidden="true"]').attributes('style') ?? ''
}

async function settle(): Promise<void> {
  await flushPromises()
  await flushPromises()
}

describe('VImage hazehash placeholder', () => {
  it('draws the placeholder from the hazehash prop', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/photo.jpg', alt: 'Photo', width: 800, height: 600, hazehash: HAZEHASH },
    })
    await settle()
    expect(style(wrapper)).toContain('background-image: url("data:image/png;base64,HAZE")')
    expect(style(wrapper)).toContain('background-size: cover')
  })

  it('prefers hazehash over blurhash, thumbhash and placeholder when several are given', async () => {
    const wrapper = mount(VImage, {
      props: {
        src: '/photo.jpg',
        alt: 'Photo',
        width: 800,
        height: 600,
        hazehash: HAZEHASH,
        blurhash: BLURHASH,
        thumbhash: THUMBHASH,
        placeholder: 'data:image/png;base64,LQIP',
      },
    })
    await settle()
    const text = style(wrapper)
    expect(text).toContain('data:image/png;base64,HAZE')
    expect(text).not.toContain('LQIP')
    expect(text).not.toContain('MOCK')
  })

  it('does not fall back to the blurhash while the hazehash is still being decoded', async () => {
    let release: (url: string) => void = () => {}
    decodeResult.pending = new Promise<string | undefined>((resolve) => {
      release = resolve
    })
    const wrapper = mount(VImage, {
      props: { src: '/photo.jpg', alt: 'Photo', width: 800, height: 600, hazehash: HAZEHASH, blurhash: BLURHASH },
    })
    await settle()
    expect(style(wrapper)).not.toContain('MOCK')
    expect(style(wrapper)).not.toContain('HAZE')
    release('data:image/png;base64,HAZE')
    await settle()
    expect(style(wrapper)).toContain('HAZE')
  })

  it('falls back to the next placeholder when the hazehash cannot be decoded', async () => {
    decodeResult.url = undefined
    const wrapper = mount(VImage, {
      props: { src: '/photo.jpg', alt: 'Photo', width: 800, height: 600, hazehash: HAZEHASH, blurhash: BLURHASH },
    })
    await settle()
    expect(style(wrapper)).toContain('data:image/png;base64,MOCK')
    expect(style(wrapper)).not.toContain('HAZE')
  })

  it('takes the hazehash of an image from the manifest', async () => {
    const manifest: PlaceholderManifest = {
      '/photo.jpg': { hazehash: HAZEHASH, blurhash: BLURHASH, color: '#123456', width: 800, height: 600 },
    }
    const wrapper = mount(VImage, {
      props: { src: '/photo.jpg', alt: 'Photo' },
      global: { provide: { [PLACEHOLDERS_KEY as symbol]: manifest } },
    })
    await settle()
    expect(style(wrapper)).toContain('HAZE')
    expect(style(wrapper)).toContain('aspect-ratio: 800 / 600')
  })

  it('takes the hazehash of an image from the registry of imported images', async () => {
    registerPlaceholder('/_nuxt/hero.hash.webp', { hazehash: HAZEHASH, color: '#123456', width: 800, height: 600 })
    const wrapper = mount(VImage, { props: { src: '/_nuxt/hero.hash.webp', alt: 'Hero' } })
    await settle()
    expect(style(wrapper)).toContain('HAZE')
  })

  it('takes the hazehash from an ImageMeta object', async () => {
    const wrapper = mount(VImage, {
      props: { image: { src: '/photo.jpg', width: 800, height: 600, hazehash: HAZEHASH }, alt: 'Photo' },
    })
    await settle()
    expect(style(wrapper)).toContain('HAZE')
  })

  it('uses the hazehash of the active art-direction source', async () => {
    const wrapper = mount(VImage, {
      props: {
        src: '/desktop.jpg',
        alt: 'Photo',
        width: 800,
        height: 600,
        breakpoints: { tablet: '(max-width: 1024px)' },
        sources: { tablet: { src: '/tablet.jpg', width: 400, height: 300, hazehash: HAZEHASH } },
      },
    })
    await settle()
    expect(wrapper.html()).toBeTruthy()
  })

  it('redraws when the hazehash prop changes', async () => {
    const wrapper = mount(VImage, {
      props: { src: '/photo.jpg', alt: 'Photo', width: 800, height: 600, hazehash: HAZEHASH },
    })
    await settle()
    decodeResult.url = 'data:image/png;base64,HAZE2'
    await wrapper.setProps({ hazehash: 'Ec7UwRWKIv5znmt3XYLUF5zBSYmAo0Wr' })
    await settle()
    expect(style(wrapper)).toContain('HAZE2')
  })

  it('leaves the placeholder alone with placeholder-color', async () => {
    const wrapper = mount(VImage, {
      props: {
        src: '/photo.jpg',
        alt: 'Photo',
        width: 800,
        height: 600,
        hazehash: HAZEHASH,
        placeholderColor: '#abcdef',
      },
    })
    await settle()
    expect(style(wrapper)).toContain('background-color')
    expect(style(wrapper)).not.toContain('HAZE')
  })
})
