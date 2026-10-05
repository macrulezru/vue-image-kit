import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import VImage from '../../src/components/VImage.vue'
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
  clearObserverPool()
})

const base = { alt: 'Photo', width: 400, height: 300 }
const attrs = { class: 'card-image', style: 'border-radius: 10px', 'data-test': 'x' }

async function settle(): Promise<void> {
  await nextTick()
  await nextTick()
}

async function reveal(wrapper: { element: Element }): Promise<void> {
  ioCallback?.([{ isIntersecting: true, target: wrapper.element } as IntersectionObserverEntry])
  await settle()
}

function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

function warnings(spy: ReturnType<typeof spyWarn>): string[] {
  return spy.mock.calls.flat().filter((arg): arg is string => typeof arg === 'string')
}

describe('VImage fallthrough attributes', () => {
  it('puts class, style and attributes on the image of a plain <img> in every state', async () => {
    const spy = spyWarn()
    const wrapper = mount(VImage, { props: { ...base, src: '/img.jpg' }, attrs })
    await settle()
    const idle = wrapper.element as HTMLElement
    expect(idle.tagName).toBe('SPAN')
    expect(idle.classList.contains('card-image')).toBe(true)
    expect(idle.getAttribute('data-test')).toBe('x')

    await reveal(wrapper)
    const img = wrapper.element as HTMLElement
    expect(img.tagName).toBe('IMG')
    expect(img.classList.contains('card-image')).toBe(true)
    expect(img.style.borderRadius).toBe('10px')
    expect(img.getAttribute('data-test')).toBe('x')
    expect(warnings(spy).filter((m) => m.includes('Extraneous'))).toEqual([])
    spy.mockRestore()
  })

  it('puts them on the <img> inside <picture> and leaves the <picture> as a plain wrapper', async () => {
    const spy = spyWarn()
    const wrapper = mount(VImage, {
      props: {
        ...base,
        src: '/desktop.jpg',
        breakpoints: { tablet: '(max-width: 1024px)' },
        sources: { tablet: { src: '/tablet.jpg', width: 800, height: 400 } },
      },
      attrs,
    })
    await settle()
    await reveal(wrapper)
    const picture = wrapper.element as HTMLElement
    expect(picture.tagName).toBe('PICTURE')
    expect(picture.classList.contains('card-image')).toBe(false)
    expect(picture.classList.contains('vik-picture')).toBe(true)
    expect(picture.getAttribute('data-test')).toBeNull()
    const img = picture.querySelector('img') as HTMLElement
    expect(img.classList.contains('card-image')).toBe(true)
    expect(img.classList.contains('vik-box')).toBe(true)
    expect(img.style.borderRadius).toBe('10px')
    expect(img.getAttribute('data-test')).toBe('x')
    expect(warnings(spy).filter((m) => m.includes('Extraneous'))).toEqual([])
    spy.mockRestore()
  })

  it('does the same for a format <picture> (avif/webp)', async () => {
    const wrapper = mount(VImage, {
      props: { ...base, src: { avif: '/a.avif', webp: '/a.webp', fallback: '/a.jpg' } },
      attrs,
    })
    await settle()
    await reveal(wrapper)
    const picture = wrapper.element as HTMLElement
    expect(picture.tagName).toBe('PICTURE')
    expect(picture.classList.contains('card-image')).toBe(false)
    expect((picture.querySelector('img') as HTMLElement).classList.contains('card-image')).toBe(true)
  })

  it('keeps a listener given by the user next to the component own load handler', async () => {
    const onClick = vi.fn()
    const onLoad = vi.fn()
    const wrapper = mount(VImage, {
      props: {
        ...base,
        src: '/desktop.jpg',
        breakpoints: { tablet: '(max-width: 1024px)' },
        sources: { tablet: { src: '/tablet.jpg', width: 800, height: 400 } },
      },
      attrs: { onClick, onLoad },
    })
    await settle()
    await reveal(wrapper)
    const img = wrapper.find('picture img')
    await img.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    await img.trigger('load')
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('puts the class on the error box as well', async () => {
    const wrapper = mount(VImage, { props: { ...base, src: '/broken.jpg', lazy: false }, attrs })
    await settle()
    await reveal(wrapper)
    await wrapper.find('img').trigger('error')
    await settle()
    const box = wrapper.element as HTMLElement
    expect(box.classList.contains('vik-box--error')).toBe(true)
    expect(box.classList.contains('card-image')).toBe(true)
  })

  it('updates the attributes when they change', async () => {
    const wrapper = mount(VImage, { props: { ...base, src: '/img.jpg' }, attrs: { class: 'one' } })
    await settle()
    await reveal(wrapper)
    expect(wrapper.classes()).toContain('one')
    await wrapper.setProps({ class: 'two' } as never)
    expect(wrapper.classes()).toContain('two')
    expect(wrapper.classes()).not.toContain('one')
  })
})

describe('VImage fallthrough attributes on the server', () => {
  async function html(props: Record<string, unknown>): Promise<string> {
    const app = createSSRApp(VImage, props)
    const originalWindow = globalThis.window
    // @ts-expect-error simulating a real server environment (no window) for this render only
    delete globalThis.window
    try {
      return await renderToString(app)
    } finally {
      globalThis.window = originalWindow
    }
  }

  it('renders the class on the server <img> even when sources make the client render a <picture>', async () => {
    const out = await html({
      ...base,
      src: '/desktop.jpg',
      breakpoints: { tablet: '(max-width: 1024px)' },
      sources: { tablet: { src: '/tablet.jpg', width: 800, height: 400 } },
      class: 'card-image',
    })
    expect(out).not.toContain('<picture')
    expect(out.match(/<img[^>]*>/)![0]).toContain('class="card-image"')
  })

  it('hydrates the picture case with a class without a mismatch or a warning', async () => {
    const props = {
      ...base,
      src: '/desktop.jpg',
      breakpoints: { tablet: '(max-width: 1024px)' },
      sources: { tablet: { src: '/tablet.jpg', width: 800, height: 400 } },
      class: 'card-image',
    }
    const out = await html(props)
    const container = document.createElement('div')
    container.innerHTML = out
    document.body.appendChild(container)
    const spy = spyWarn()
    try {
      createSSRApp(VImage, props).mount(container)
      expect(warnings(spy).filter((m) => m.includes('Hydration') || m.includes('Extraneous'))).toEqual([])
    } finally {
      spy.mockRestore()
      document.body.removeChild(container)
    }
  })
})
