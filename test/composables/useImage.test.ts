import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useImage } from '../../src/composables/useImage'
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

function triggerIntersect(target?: Element): void {
  ioCallback?.([{ isIntersecting: true, target } as IntersectionObserverEntry])
}

describe('useImage', () => {
  it('starts with status = idle', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { status } = useImage({ src: '/img.jpg' })
        return { status }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.status).toBe('idle')
  })

  it('transitions idle → loading when intersecting (lazy=true)', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { status, observe } = useImage({ src: '/img.jpg', lazy: true })
        observe(elRef)
        return { status, elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    expect(wrapper.vm.status).toBe('idle')

    triggerIntersect(wrapper.element)
    await nextTick()
    await nextTick()

    expect(wrapper.vm.status).toBe('loading')
  })

  it('transitions to loading immediately when lazy=false', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { status } = useImage({ src: '/img.jpg', lazy: false })
        return { status }
      },
      template: '<div />',
    }))

    await nextTick()
    expect(wrapper.vm.status).toBe('loading')
  })

  it('transitions loading → loaded on onImgLoad()', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { status, observe, onImgLoad } = useImage({ src: '/img.jpg', lazy: true })
        observe(elRef)
        return { status, elRef, onImgLoad }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    wrapper.vm.onImgLoad()
    await nextTick()

    expect(wrapper.vm.status).toBe('loaded')
  })

  it('transitions loading → error on onImgError()', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { status, observe, onImgError } = useImage({ src: '/img.jpg', lazy: true })
        observe(elRef)
        return { status, elRef, onImgError }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    triggerIntersect()
    await nextTick()
    await nextTick()

    wrapper.vm.onImgError()
    await nextTick()

    expect(wrapper.vm.status).toBe('error')
  })

  it('isLoaded is true only when status = loaded', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { status, isLoaded, onImgLoad } = useImage({ src: '/img.jpg', lazy: false })
        return { status, isLoaded, onImgLoad }
      },
      template: '<div />',
    }))

    await nextTick()
    expect(wrapper.vm.isLoaded).toBe(false)

    wrapper.vm.onImgLoad()
    await nextTick()

    expect(wrapper.vm.isLoaded).toBe(true)
  })

  it('isError is true only when status = error', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { isError, onImgError } = useImage({ src: '/img.jpg', lazy: false })
        return { isError, onImgError }
      },
      template: '<div />',
    }))

    await nextTick()
    expect(wrapper.vm.isError).toBe(false)

    wrapper.vm.onImgError()
    await nextTick()

    expect(wrapper.vm.isError).toBe(true)
  })

  it('imgAttrs contains src', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({ src: '/img.jpg' })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.src).toBe('/img.jpg')
  })

  it('imgAttrs contains correct srcset when widths provided', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({ src: '/img.jpg', widths: [400, 800] })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.srcset).toBe('/img.jpg 400w, /img.jpg 800w')
  })

  it('imgAttrs has no srcset when widths is empty', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({ src: '/img.jpg', widths: [] })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.srcset).toBeUndefined()
  })

  it('imgAttrs builds a density srcset and omits sizes when densities provided', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({ src: '/logo.png', densities: [1, 2, 3] })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.srcset).toBe('/logo.png 1x, /logo.png 2x, /logo.png 3x')
    expect(wrapper.vm.imgAttrs.sizes).toBeUndefined()
  })

  it('imgAttrs builds a density srcset from a per-density URL map (distinct files)', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({
          src: '/a.png',
          densities: { 1: '/a.png', 2: '/a@2x.png', 3: '/a@3x.png' },
        })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.srcset).toBe('/a.png 1x, /a@2x.png 2x, /a@3x.png 3x')
    expect(wrapper.vm.imgAttrs.sizes).toBeUndefined()
  })

  it('imgAttrs prefers density over width descriptors when both are set', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({ src: '/logo.png', widths: [400, 800], densities: [1, 2] })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.srcset).toBe('/logo.png 1x, /logo.png 2x')
  })

  it('uses fallback src from SrcSet object', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { imgAttrs } = useImage({
          src: { avif: '/img.avif', webp: '/img.webp', fallback: '/img.jpg' },
        })
        return { imgAttrs }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.imgAttrs.src).toBe('/img.jpg')
  })
})
