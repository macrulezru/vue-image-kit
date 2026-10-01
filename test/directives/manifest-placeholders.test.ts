import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, withDirectives } from 'vue'
import { mount } from '@vue/test-utils'
import { VImageKitPlugin } from '../../src/index'
import { useBackgroundImage } from '../../src/composables/useBackgroundImage'
import { vLazyImg } from '../../src/directives/vLazyImg'
import { clearObserverPool } from '../../src/utils/observer-pool'
import type { PlaceholderManifest } from '../../src/types'

const BLURHASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

const manifest: PlaceholderManifest = {
  '/photo.jpg': { blurhash: BLURHASH, color: '#123456', width: 800, height: 600 },
  '/flat.jpg': { color: '#abcdef' },
}

beforeEach(() => {
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

function mountDirective(value: string | { src: string; placeholder?: string }) {
  const Comp = defineComponent({
    render() {
      return withDirectives(h('div'), [[vLazyImg, value]])
    },
  })
  return mount(Comp, { global: { plugins: [[VImageKitPlugin, { placeholders: manifest }]] } })
}

describe('v-lazy-img — placeholders manifest', () => {
  it('paints the decoded blur and the color before the image loads', async () => {
    const wrapper = mountDirective('/photo.jpg')
    await nextTick()
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).toContain('background-image: url("data:image/png;base64,MOCK')
    expect(style).toContain('background-color: rgb(18, 52, 86)')
  })

  it('uses only the color when the entry has no hash', async () => {
    const wrapper = mountDirective('/flat.jpg')
    await nextTick()
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).toContain('background-color: rgb(171, 205, 239)')
    expect(style).not.toContain('background-image')
  })

  it('leaves images without an entry untouched', async () => {
    const wrapper = mountDirective('/other.jpg')
    await nextTick()
    expect(wrapper.element.getAttribute('style') ?? '').toBe('')
  })

  it('an explicit placeholder option wins over the manifest', async () => {
    const wrapper = mountDirective({ src: '/photo.jpg', placeholder: 'data:x' })
    await nextTick()
    expect(wrapper.element.getAttribute('style') ?? '').not.toContain('rgb(18, 52, 86)')
  })
})

describe('useBackgroundImage — placeholders manifest', () => {
  function mountComposable(src: string, placeholder?: string) {
    const Comp = defineComponent({
      setup() {
        const bg = useBackgroundImage(src, placeholder ? { placeholder } : {})
        return () => h('div', { ref: bg.target, style: bg.style.value })
      },
    })
    return mount(Comp, { global: { plugins: [[VImageKitPlugin, { placeholders: manifest }]] } })
  }

  it('shows the manifest color right away and the decoded blur after mount', async () => {
    const wrapper = mountComposable('/photo.jpg')
    await nextTick()
    await nextTick()
    const style = wrapper.element.getAttribute('style') ?? ''
    expect(style).toContain('background-color: rgb(18, 52, 86)')
    expect(style).toContain('background-image: url("data:image/png;base64,MOCK')
  })

  it('does nothing for a src that is not in the manifest', async () => {
    const wrapper = mountComposable('/other.jpg')
    await nextTick()
    expect(wrapper.element.getAttribute('style') ?? '').not.toContain('background-color')
  })

  it('an explicit placeholder wins over the manifest', async () => {
    const wrapper = mountComposable('/photo.jpg', 'data:img')
    await nextTick()
    expect(wrapper.element.getAttribute('style') ?? '').not.toContain('rgb(18, 52, 86)')
  })
})
