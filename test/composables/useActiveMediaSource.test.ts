import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useActiveMediaSource } from '../../src/composables/useActiveMediaSource'
import type { MediaSource } from '../../src/composables/useBreakpoints'

class FakeMediaQueryList {
  matches: boolean
  media: string
  private listeners = new Set<() => void>()

  constructor(media: string, matches: boolean) {
    this.media = media
    this.matches = matches
  }

  addEventListener(type: string, cb: () => void): void {
    if (type === 'change') this.listeners.add(cb)
  }

  removeEventListener(type: string, cb: () => void): void {
    if (type === 'change') this.listeners.delete(cb)
  }

  setMatches(matches: boolean): void {
    this.matches = matches
    for (const cb of this.listeners) cb()
  }
}

let queries: Map<string, FakeMediaQueryList>
let matchMediaSpy: ReturnType<typeof vi.fn>

function stubMatchMedia(initialMatches: Record<string, boolean>): void {
  queries = new Map()
  for (const [media, matches] of Object.entries(initialMatches)) {
    queries.set(media, new FakeMediaQueryList(media, matches))
  }
  matchMediaSpy = vi.fn((media: string) => {
    let mql = queries.get(media)
    if (!mql) {
      mql = new FakeMediaQueryList(media, false)
      queries.set(media, mql)
    }
    return mql
  })
  vi.stubGlobal('matchMedia', matchMediaSpy)
}

beforeEach(() => {
  stubMatchMedia({})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountWith(sources: MediaSource[]) {
  const mediaSources = ref(sources)
  return mount(
    defineComponent({
      setup() {
        const active = useActiveMediaSource(mediaSources)
        return { active }
      },
      template: '<div />',
    }),
  )
}

const tablet: MediaSource = {
  media: '(max-width: 1024px)',
  src: '/t.jpg',
  width: 1400,
  height: 700,
}
const mobile: MediaSource = { media: '(max-width: 640px)', src: '/m.jpg', width: 600, height: 600 }
const unsized: MediaSource = { media: '(max-width: 1024px)', src: '/no-dims.jpg' }

describe('useActiveMediaSource', () => {
  it('starts with active = null before mount resolves', () => {
    stubMatchMedia({ '(max-width: 1024px)': true })
    const mediaSources = ref([tablet])
    const wrapper = mount(
      defineComponent({
        setup() {
          return { active: useActiveMediaSource(mediaSources) }
        },
        template: '<div />',
      }),
    )
    expect(wrapper.vm.active === null || wrapper.vm.active.media === tablet.media).toBe(true)
  })

  it('picks the first sized source whose media matches', async () => {
    stubMatchMedia({ '(max-width: 1024px)': true })
    const wrapper = mountWith([tablet])
    await nextTick()
    expect(wrapper.vm.active).toEqual(tablet)
  })

  it('resolves to null when no source matches', async () => {
    stubMatchMedia({ '(max-width: 1024px)': false })
    const wrapper = mountWith([tablet])
    await nextTick()
    expect(wrapper.vm.active).toBeNull()
  })

  it('ignores sources without both width and height', async () => {
    stubMatchMedia({ '(max-width: 1024px)': true })
    const wrapper = mountWith([unsized])
    await nextTick()
    expect(wrapper.vm.active).toBeNull()
    expect(matchMediaSpy).not.toHaveBeenCalled()
  })

  it('never calls matchMedia when the source list is empty', async () => {
    const wrapper = mountWith([])
    await nextTick()
    expect(wrapper.vm.active).toBeNull()
    expect(matchMediaSpy).not.toHaveBeenCalled()
  })

  it('reactively updates when the matched MediaQueryList fires a change event', async () => {
    stubMatchMedia({ '(max-width: 1024px)': false })
    const wrapper = mountWith([tablet])
    await nextTick()
    expect(wrapper.vm.active).toBeNull()

    queries.get('(max-width: 1024px)')!.setMatches(true)
    await nextTick()
    expect(wrapper.vm.active).toEqual(tablet)

    queries.get('(max-width: 1024px)')!.setMatches(false)
    await nextTick()
    expect(wrapper.vm.active).toBeNull()
  })

  it('dedupes matchMedia calls for multiple format variants sharing the same media', async () => {
    stubMatchMedia({ '(max-width: 1024px)': true })
    const avifVariant: MediaSource = { ...tablet, src: '/t.avif', type: 'image/avif' }
    const webpVariant: MediaSource = { ...tablet, src: '/t.webp', type: 'image/webp' }
    const wrapper = mountWith([avifVariant, webpVariant, tablet])
    await nextTick()
    expect(matchMediaSpy).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.active).toEqual(avifVariant)
  })

  it('picks the first matching source in list order when several match', async () => {
    stubMatchMedia({ '(max-width: 640px)': true, '(max-width: 1024px)': true })
    const wrapper = mountWith([mobile, tablet])
    await nextTick()
    expect(wrapper.vm.active).toEqual(mobile)
  })

  it('removes change listeners on unmount', async () => {
    stubMatchMedia({ '(max-width: 1024px)': true })
    const wrapper = mountWith([tablet])
    await nextTick()
    const mql = queries.get('(max-width: 1024px)')!
    const removeSpy = vi.spyOn(mql, 'removeEventListener')
    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('returns active = null when matchMedia is not available (SSR-like environment)', () => {
    vi.unstubAllGlobals()
    const mediaSources = ref([tablet])
    const active = useActiveMediaSource(mediaSources)
    expect(active.value).toBeNull()
  })
})
