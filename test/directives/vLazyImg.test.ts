import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { vLazyImg } from '../../src/directives/vLazyImg'
import { clearObserverPool } from '../../src/utils/observer-pool'

// v-lazy-img shares the same IntersectionObserver pool (utils/observer-pool.ts)
// as every other lazy-loading path now — see useLazyLoad.test.ts for the same
// mocking pattern. `ioCallback` always captures the LATEST pool entry's
// callback (elements sharing a rootMargin+threshold share one real observer),
// which is enough for these single-element tests; clearObserverPool() between
// tests keeps each test's pool state (and therefore IntersectionObserver call
// count) independent.
type IOCallback = (entries: IntersectionObserverEntry[]) => void

let ioCallback: IOCallback | null = null
let observeMock: ReturnType<typeof vi.fn>
let unobserveMock: ReturnType<typeof vi.fn>
let disconnectMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clearObserverPool()
  ioCallback = null
  observeMock = vi.fn()
  unobserveMock = vi.fn()
  disconnectMock = vi.fn()

  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IOCallback) => {
      ioCallback = cb
      return { observe: observeMock, unobserve: unobserveMock, disconnect: disconnectMock }
    }),
  )

  vi.stubGlobal('Image', class {
    src = ''
    onload: (() => void) | null = null
    onerror: ((e: Event) => void) | null = null
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearObserverPool()
})

function triggerIntersect(el: Element): void {
  ioCallback?.([{ isIntersecting: true, target: el } as IntersectionObserverEntry])
}

const TestComponent = (value: string | object) =>
  defineComponent({
    directives: { 'lazy-img': vLazyImg },
    setup: () => ({ value }),
    template: '<div v-lazy-img="value" style="width:100px;height:100px" />',
  })

describe('vLazyImg directive', () => {
  it('creates IntersectionObserver on mount', async () => {
    mount(TestComponent('/bg.jpg'))
    await nextTick()
    expect(IntersectionObserver).toHaveBeenCalled()
    expect(observeMock).toHaveBeenCalled()
  })

  it('sets background-image on intersection (string value)', async () => {
    let capturedLoad: (() => void) | null = null

    vi.stubGlobal('Image', class {
      src = ''
      set onload(fn: (() => void) | null) { capturedLoad = fn }
      get onload() { return capturedLoad }
      onerror: ((e: Event) => void) | null = null
    })

    const wrapper = mount(TestComponent('/bg.jpg'))
    await nextTick()

    const el = wrapper.element as HTMLElement
    triggerIntersect(el)
    await nextTick()

    capturedLoad?.()
    await nextTick()

    expect(el.style.backgroundImage).toMatch(/url\(["']?\/bg\.jpg["']?\)/)
  })

  it('sets placeholder first, then real image on intersection (object value)', async () => {
    let capturedLoad: (() => void) | null = null

    vi.stubGlobal('Image', class {
      src = ''
      set onload(fn: (() => void) | null) { capturedLoad = fn }
      get onload() { return capturedLoad }
      onerror: ((e: Event) => void) | null = null
    })

    const wrapper = mount(TestComponent({
      src: '/bg.jpg',
      placeholder: 'data:image/jpeg;base64,/9j/abc',
    }))
    await nextTick()

    const el = wrapper.element as HTMLElement
    triggerIntersect(el)
    await nextTick()

    expect(el.style.backgroundImage).toMatch(/url\(["']?data:image/)

    capturedLoad?.()
    await nextTick()
    expect(el.style.backgroundImage).toMatch(/url\(["']?\/bg\.jpg["']?\)/)
  })

  it('calls onLoad callback after image loads', async () => {
    let capturedLoad: (() => void) | null = null
    vi.stubGlobal('Image', class {
      src = ''
      set onload(fn: (() => void) | null) { capturedLoad = fn }
      get onload() { return capturedLoad }
      onerror: ((e: Event) => void) | null = null
    })

    const onLoad = vi.fn()
    const wrapper = mount(TestComponent({ src: '/bg.jpg', onLoad }))
    await nextTick()

    triggerIntersect(wrapper.element)
    await nextTick()
    capturedLoad?.()

    expect(onLoad).toHaveBeenCalled()
  })

  it('calls onError callback on image error', async () => {
    let capturedError: ((e: Event) => void) | null = null
    vi.stubGlobal('Image', class {
      src = ''
      onload: (() => void) | null = null
      set onerror(fn: ((e: Event) => void) | null) { capturedError = fn }
      get onerror() { return capturedError }
    })

    const onError = vi.fn()
    const wrapper = mount(TestComponent({ src: '/bad.jpg', onError }))
    await nextTick()

    triggerIntersect(wrapper.element)
    await nextTick()
    capturedError?.(new Event('error'))

    expect(onError).toHaveBeenCalled()
  })

  it('uses custom rootMargin from options', async () => {
    const MockIO = vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() }))
    vi.stubGlobal('IntersectionObserver', MockIO)

    mount(TestComponent({ src: '/bg.jpg', rootMargin: '50px' }))
    await nextTick()

    expect(MockIO).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: '50px',
      threshold: 0,
    })
  })

  it('disconnects observer on unmount', async () => {
    const wrapper = mount(TestComponent('/bg.jpg'))
    await nextTick()
    wrapper.unmount()
    expect(disconnectMock).toHaveBeenCalled()
  })

  it('disconnects and re-observes on update', async () => {
    const wrapper = mount(
      defineComponent({
        directives: { 'lazy-img': vLazyImg },
        data: () => ({ src: '/a.jpg' }),
        template: '<div v-lazy-img="src" />',
      }),
    )
    await nextTick()
    const callsBefore = (IntersectionObserver as ReturnType<typeof vi.fn>).mock.calls.length

    await wrapper.setData({ src: '/b.jpg' })
    await nextTick()

    expect((IntersectionObserver as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('shares one IntersectionObserver across multiple elements with the same rootMargin/threshold', async () => {
    // Regression: v-lazy-img used to create its own dedicated IntersectionObserver
    // per element (createObserver()) instead of going through the shared pool
    // every other lazy-loading path (useLazyLoad/useImage/<VImage>/
    // useBackgroundImage) already uses — a real inconsistency on pages with many
    // lazily-loaded backgrounds.
    const MultiComponent = defineComponent({
      directives: { 'lazy-img': vLazyImg },
      template: `
        <div>
          <div class="a" v-lazy-img="'/a.jpg'" />
          <div class="b" v-lazy-img="'/b.jpg'" />
          <div class="c" v-lazy-img="'/c.jpg'" />
        </div>
      `,
    })

    mount(MultiComponent)
    await nextTick()

    expect(IntersectionObserver).toHaveBeenCalledTimes(1)
    expect(observeMock).toHaveBeenCalledTimes(3)
  })
})
