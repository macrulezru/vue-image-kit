import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { observeShared, clearObserverPool } from '../../src/utils/observer-pool'

type IOCallback = (entries: IntersectionObserverEntry[]) => void

interface MockIO {
  callback: IOCallback
  options?: IntersectionObserverInit
  observed: Set<Element>
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

let instances: MockIO[] = []

beforeEach(() => {
  instances = []
  clearObserverPool()

  const Mock = vi.fn((callback: IOCallback, options?: IntersectionObserverInit) => {
    const inst: MockIO = {
      callback,
      options,
      observed: new Set<Element>(),
      observe: vi.fn((el: Element) => inst.observed.add(el)),
      unobserve: vi.fn((el: Element) => inst.observed.delete(el)),
      disconnect: vi.fn(() => inst.observed.clear()),
    }
    instances.push(inst)
    return inst
  })

  vi.stubGlobal('IntersectionObserver', Mock)
})

afterEach(() => {
  clearObserverPool()
  vi.unstubAllGlobals()
})

/** Find the observer instance currently watching `el`, then fire intersection for it. */
function intersect(el: Element, isIntersecting = true): void {
  const inst = instances.find((i) => i.observed.has(el))
  inst?.callback([{ isIntersecting, target: el } as IntersectionObserverEntry])
}

const div = () => document.createElement('div')

describe('observeShared', () => {
  it('creates one observer with the given rootMargin and threshold', () => {
    observeShared(div(), '50px', 0.25, () => {})
    expect(instances).toHaveLength(1)
    expect(instances[0]!.options).toEqual({ rootMargin: '50px', threshold: 0.25 })
  })

  it('shares a single observer across elements with identical config', () => {
    observeShared(div(), '0px', 0, () => {})
    observeShared(div(), '0px', 0, () => {})
    observeShared(div(), '0px', 0, () => {})
    expect(instances).toHaveLength(1)
    expect(instances[0]!.observe).toHaveBeenCalledTimes(3)
  })

  it('creates separate observers for differing config', () => {
    observeShared(div(), '0px', 0, () => {})
    observeShared(div(), '100px', 0, () => {})
    observeShared(div(), '0px', 0.5, () => {})
    expect(instances).toHaveLength(3)
  })

  it('observes the element', () => {
    const el = div()
    observeShared(el, '0px', 0, () => {})
    expect(instances[0]!.observe).toHaveBeenCalledWith(el)
  })

  it('fires the callback only for the element that intersects', () => {
    const a = div(), b = div()
    const onA = vi.fn(), onB = vi.fn()
    observeShared(a, '0px', 0, onA)
    observeShared(b, '0px', 0, onB)

    intersect(a, true)
    expect(onA).toHaveBeenCalledTimes(1)
    expect(onB).not.toHaveBeenCalled()
  })

  it('does not fire when isIntersecting is false', () => {
    const el = div()
    const cb = vi.fn()
    observeShared(el, '0px', 0, cb)
    intersect(el, false)
    expect(cb).not.toHaveBeenCalled()
  })

  it('is one-shot: unobserves the element after it intersects', () => {
    const el = div()
    const cb = vi.fn()
    observeShared(el, '0px', 0, cb)
    intersect(el, true)
    intersect(el, true) // second fire must be ignored — already unobserved
    expect(cb).toHaveBeenCalledTimes(1)
    expect(instances[0]!.unobserve).toHaveBeenCalledWith(el)
  })

  it('disconnects and drops the pool entry once the last element resolves', () => {
    const a = div(), b = div()
    observeShared(a, '0px', 0, () => {})
    observeShared(b, '0px', 0, () => {})

    intersect(a, true)
    expect(instances[0]!.disconnect).not.toHaveBeenCalled() // b still watched
    intersect(b, true)
    expect(instances[0]!.disconnect).toHaveBeenCalled()

    // Pool entry was removed → next observe builds a fresh observer
    observeShared(div(), '0px', 0, () => {})
    expect(instances).toHaveLength(2)
  })

  it('unsubscribe removes the element and disconnects when it was the last one', () => {
    const el = div()
    const stop = observeShared(el, '0px', 0, () => {})
    stop()
    expect(instances[0]!.unobserve).toHaveBeenCalledWith(el)
    expect(instances[0]!.disconnect).toHaveBeenCalled()
  })

  it('unsubscribe of one element keeps the shared observer alive for others', () => {
    const a = div(), b = div()
    const stopA = observeShared(a, '0px', 0, () => {})
    observeShared(b, '0px', 0, () => {})

    stopA()
    expect(instances[0]!.unobserve).toHaveBeenCalledWith(a)
    expect(instances[0]!.disconnect).not.toHaveBeenCalled()
  })
})

describe('clearObserverPool', () => {
  it('disconnects every pooled observer and empties the pool', () => {
    observeShared(div(), '0px', 0, () => {})
    observeShared(div(), '100px', 0, () => {})
    expect(instances).toHaveLength(2)

    clearObserverPool()
    expect(instances[0]!.disconnect).toHaveBeenCalled()
    expect(instances[1]!.disconnect).toHaveBeenCalled()

    // Pool is empty → observing again allocates fresh observers
    observeShared(div(), '0px', 0, () => {})
    expect(instances).toHaveLength(3)
  })
})
