import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useBackgroundImage, type UseBackgroundImageOptions } from '../../src/composables/useBackgroundImage'
import { clearObserverPool } from '../../src/utils/observer-pool'

type IOCallback = (entries: IntersectionObserverEntry[]) => void
let observerCallback: IOCallback | null = null
let observedEl: Element | null = null

// Image stub — fires onload on the next microtask when src is assigned.
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  set src(v: string) {
    this._src = v
    Promise.resolve().then(() => this.onload?.())
  }
  get src(): string {
    return this._src
  }
}

beforeEach(() => {
  observerCallback = null
  observedEl = null
  clearObserverPool()

  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IOCallback) => {
      observerCallback = cb
      return {
        observe: vi.fn((el: Element) => {
          observedEl = el
        }),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }
    }),
  )
  vi.stubGlobal('Image', MockImage)
})

afterEach(() => {
  clearObserverPool()
  vi.unstubAllGlobals()
})

function mountBg(src: string, opts: UseBackgroundImageOptions = {}) {
  return mount(
    defineComponent({
      setup() {
        const { target, style, status, isLoaded, isLoading, load } = useBackgroundImage(src, opts)
        return { target, style, status, isLoaded, isLoading, load }
      },
      template: '<div ref="target" />',
    }),
  )
}

async function intersect(): Promise<void> {
  observerCallback?.([{ isIntersecting: true, target: observedEl! } as IntersectionObserverEntry])
  await nextTick()
  await Promise.resolve() // let the Image.onload microtask run
  await nextTick()
}

describe('useBackgroundImage', () => {
  it('starts idle and shows the placeholder (blurred) before load', async () => {
    const wrapper = mountBg('/bg.jpg', { placeholder: 'data:image/jpeg;base64,AAAA' })
    await nextTick()
    expect(wrapper.vm.status).toBe('idle')
    const style = wrapper.vm.style as Record<string, string>
    expect(style.backgroundImage).toBe('url("data:image/jpeg;base64,AAAA")')
    expect(style.filter).toBe('blur(8px)')
  })

  it('loads when the element intersects and swaps to the full image', async () => {
    const wrapper = mountBg('/bg.jpg', { placeholder: 'data:image/jpeg;base64,AAAA' })
    await nextTick()
    await intersect()

    expect(wrapper.vm.status).toBe('loaded')
    const style = wrapper.vm.style as Record<string, string>
    expect(style.backgroundImage).toBe('url("/bg.jpg")')
    expect(style.filter).toBe('')
  })

  it('builds an image-set() value from densities once loaded', async () => {
    const wrapper = mountBg('/bg.jpg', { densities: [1, 2] })
    await nextTick()
    await intersect()

    const style = wrapper.vm.style as Record<string, string>
    expect(style.backgroundImage).toBe('image-set(url("/bg.jpg") 1x, url("/bg.jpg") 2x)')
  })

  it('includes a type() hint in image-set entries when provided', async () => {
    const wrapper = mountBg('/bg.webp', { densities: [1, 2], type: 'image/webp' })
    await nextTick()
    await intersect()

    const style = wrapper.vm.style as Record<string, string>
    expect(style.backgroundImage).toBe(
      'image-set(url("/bg.webp") type("image/webp") 1x, url("/bg.webp") type("image/webp") 2x)',
    )
  })

  it('loads immediately on mount when lazy is false', async () => {
    const wrapper = mountBg('/bg.jpg', { lazy: false })
    // mount → onMounted load() → loading, then Image.onload
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(wrapper.vm.status).toBe('loaded')
  })

  it('exposes a default background-size/position', async () => {
    const wrapper = mountBg('/bg.jpg')
    await nextTick()
    const style = wrapper.vm.style as Record<string, string>
    expect(style.backgroundSize).toBe('cover')
    expect(style.backgroundPosition).toBe('center')
  })

  it('sets status to error when the image fails to load', async () => {
    // Image stub that fires onerror instead
    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        Promise.resolve().then(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', FailingImage)

    const wrapper = mountBg('/missing.jpg', { lazy: false })
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(wrapper.vm.status).toBe('error')
  })
})
