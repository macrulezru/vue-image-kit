import type { Directive, DirectiveBinding } from 'vue'
import type { LazyImgOptions } from '../types'

interface LazyImgState {
  observer: IntersectionObserver | null
  src: string
}

const stateMap = new WeakMap<HTMLElement, LazyImgState>()

function resolveOptions(binding: DirectiveBinding<string | LazyImgOptions>): LazyImgOptions {
  if (typeof binding.value === 'string') {
    return { src: binding.value }
  }
  return binding.value
}

function applyImage(el: HTMLElement, options: LazyImgOptions): void {
  const { placeholder, src, onLoad, onError, transition = '0.4s ease' } = options

  if (placeholder) {
    el.style.backgroundImage = `url(${placeholder})`
    el.style.backgroundSize = 'cover'
    el.style.backgroundPosition = 'center'
    el.style.filter = 'blur(8px)'
    el.style.transform = 'scale(1.05)'
    el.style.transition = `filter ${transition}, transform ${transition}`
  }

  const img = new Image()

  img.onload = () => {
    el.style.backgroundImage = `url(${src})`
    el.style.backgroundSize = 'cover'
    el.style.backgroundPosition = 'center'
    el.style.filter = ''
    el.style.transform = ''
    onLoad?.()
  }

  img.onerror = (e) => {
    el.style.filter = ''
    el.style.transform = ''
    onError?.(e instanceof Event ? e : new Event('error'))
  }

  img.src = src
}

function createObserver(el: HTMLElement, options: LazyImgOptions): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    applyImage(el, options)
    return null
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          applyImage(el, options)
          observer.disconnect()
          const state = stateMap.get(el)
          if (state) state.observer = null
        }
      }
    },
    {
      rootMargin: options.rootMargin ?? '200px',
      threshold: options.threshold ?? 0,
    },
  )

  observer.observe(el)
  return observer
}

export const vLazyImg: Directive<HTMLElement, string | LazyImgOptions> = {
  mounted(el, binding) {
    const options = resolveOptions(binding)
    const observer = createObserver(el, options)
    stateMap.set(el, { observer, src: options.src })
  },

  updated(el, binding) {
    const options = resolveOptions(binding)
    const state = stateMap.get(el)

    // Skip reconnect if src hasn't changed — prevents reactivity loops
    // when parent re-renders with identical data but new object references
    if (state?.src === options.src) return

    state?.observer?.disconnect()
    const observer = createObserver(el, options)
    stateMap.set(el, { observer, src: options.src })
  },

  unmounted(el) {
    const state = stateMap.get(el)
    state?.observer?.disconnect()
    stateMap.delete(el)
  },
}
