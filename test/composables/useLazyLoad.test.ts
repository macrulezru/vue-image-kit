import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useLazyLoad } from '../../src/composables/useLazyLoad'
import { clearObserverPool } from '../../src/utils/observer-pool'

type IOCallback = (entries: IntersectionObserverEntry[]) => void
type IOInstance = { observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; callback: IOCallback }

let observerInstance: IOInstance | null = null

beforeEach(() => {
  observerInstance = null
  clearObserverPool()

  const MockIO = vi.fn((callback: IOCallback, _options?: IntersectionObserverInit) => {
    const instance: IOInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
      callback,
    }
    observerInstance = instance
    return instance
  })

  vi.stubGlobal('IntersectionObserver', MockIO)
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearObserverPool()
})

function triggerIntersection(isIntersecting: boolean, target?: Element): void {
  observerInstance?.callback([
    { isIntersecting, target } as IntersectionObserverEntry,
  ])
}

describe('useLazyLoad', () => {
  it('starts with isIntersecting = false', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const { isIntersecting } = useLazyLoad()
        return { isIntersecting }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.isIntersecting).toBe(false)
  })

  it('sets isIntersecting = true when IO fires', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isIntersecting, observe } = useLazyLoad()
        observe(elRef)
        return { isIntersecting, elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    triggerIntersection(true, wrapper.element)
    await nextTick()

    expect(wrapper.vm.isIntersecting).toBe(true)
  })

  it('does not set isIntersecting when isIntersecting is false', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isIntersecting, observe } = useLazyLoad()
        observe(elRef)
        return { isIntersecting, elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    triggerIntersection(false, wrapper.element)
    await nextTick()

    expect(wrapper.vm.isIntersecting).toBe(false)
  })

  it('disconnects observer after intersection', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isIntersecting, observe } = useLazyLoad()
        observe(elRef)
        return { isIntersecting, elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    triggerIntersection(true, wrapper.element)
    await nextTick()

    expect(observerInstance?.disconnect).toHaveBeenCalled()
  })

  it('passes rootMargin and threshold to IntersectionObserver', async () => {
    const MockIO = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
    vi.stubGlobal('IntersectionObserver', MockIO)

    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { observe } = useLazyLoad({ rootMargin: '100px', threshold: 0.5 })
        observe(elRef)
        return { elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()
    expect(MockIO).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: '100px',
      threshold: 0.5,
    })
    wrapper.unmount()
  })

  it('disconnects on unmount', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const elRef = ref<HTMLElement | null>(null)
        const { isIntersecting, observe } = useLazyLoad()
        observe(elRef)
        return { isIntersecting, elRef }
      },
      template: '<div ref="elRef" />',
    }))

    await nextTick()   // let deferred observe() run
    wrapper.unmount()  // triggers onUnmounted → unsubscribe → disconnect
    expect(observerInstance?.disconnect).toHaveBeenCalled()
  })

  it('returns isIntersecting = true on SSR (no window)', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error simulate SSR
    delete globalThis.window

    const result = useLazyLoad()
    expect(result.isIntersecting.value).toBe(true)

    globalThis.window = originalWindow
  })
})
