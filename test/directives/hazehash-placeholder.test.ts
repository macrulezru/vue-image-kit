import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, withDirectives } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { VImageKitPlugin } from '../../src/index'
import { useBackgroundImage } from '../../src/composables/useBackgroundImage'
import { vLazyImg } from '../../src/directives/vLazyImg'
import { clearObserverPool } from '../../src/utils/observer-pool'
import type { PlaceholderManifest } from '../../src/types'

const decodeResult = vi.hoisted(() => ({ url: 'data:image/png;base64,HAZE' as string | undefined }))

vi.mock('../../src/utils/hazehash-decode', () => ({
  hazehashToDataUrl: vi.fn(async () => decodeResult.url),
  loadHazehash: vi.fn(async () => null),
}))

const manifest: PlaceholderManifest = {
  '/photo.jpg': {
    hazehash: 'Ed7UwRWKKv5znndNd2Ba284jhm2TLgpUMa0UkQ',
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    color: '#123456',
    width: 800,
    height: 600,
  },
}

beforeEach(() => {
  decodeResult.url = 'data:image/png;base64,HAZE'
  clearObserverPool()
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
  )
  vi.stubGlobal(
    'Image',
    class {
      src = ''
      onload: (() => void) | null = null
      onerror: ((e: Event) => void) | null = null
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearObserverPool()
})

describe('v-lazy-img with a hazehash in the manifest', () => {
  function mountDirective() {
    const Comp = defineComponent({
      render() {
        return withDirectives(h('div'), [[vLazyImg, '/photo.jpg']])
      },
    })
    return mount(Comp, { global: { plugins: [[VImageKitPlugin, { placeholders: manifest }]] } })
  }

  it('paints the decoded hazehash in front of the blurhash, with the color', async () => {
    const wrapper = mountDirective()
    await flushPromises()
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).toContain('data:image/png;base64,HAZE')
    expect(style).not.toContain('MOCK')
    expect(style).toContain('background-color: rgb(18, 52, 86)')
  })

  it('falls back to the blurhash when the hazehash cannot be decoded', async () => {
    decodeResult.url = undefined
    const wrapper = mountDirective()
    await flushPromises()
    await nextTick()
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).toContain('data:image/png;base64,MOCK')
  })
})

describe('useBackgroundImage with a hazehash in the manifest', () => {
  it('uses the decoded hazehash as the placeholder image', async () => {
    const Comp = defineComponent({
      setup() {
        const { style } = useBackgroundImage('/photo.jpg', { lazy: true })
        return { style }
      },
      render() {
        return h('div', { style: this.style as never })
      },
    })
    const wrapper = mount(Comp, { global: { plugins: [[VImageKitPlugin, { placeholders: manifest }]] } })
    await flushPromises()
    expect(wrapper.element.getAttribute('style') ?? '').toContain('data:image/png;base64,HAZE')
  })
})
