import type { Directive, DirectiveBinding } from 'vue'
import type { LazyImgOptions } from '../types'
import { observeShared } from '../utils/observer-pool'

interface LazyImgState {
  unsubscribe: (() => void) | null
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

// Shared with every other lazy-loading path (useLazyLoad/useImage/<VImage>/
// useBackgroundImage) via utils/observer-pool.ts, instead of each `v-lazy-img`
// element creating its own dedicated IntersectionObserver — the pool buckets
// elements by rootMargin+threshold so pages with many lazy images share one
// observer per distinct config instead of one per element.
function watchIntersection(el: HTMLElement, options: LazyImgOptions): (() => void) | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    applyImage(el, options)
    return null
  }

  return observeShared(el, options.rootMargin ?? '200px', options.threshold ?? 0, () => {
    applyImage(el, options)
    const state = stateMap.get(el)
    if (state) state.unsubscribe = null
  })
}

export const vLazyImg: Directive<HTMLElement, string | LazyImgOptions> = {
  mounted(el, binding) {
    const options = resolveOptions(binding)
    const unsubscribe = watchIntersection(el, options)
    stateMap.set(el, { unsubscribe, src: options.src })
  },

  updated(el, binding) {
    const options = resolveOptions(binding)
    const state = stateMap.get(el)

    // Skip reconnect if src hasn't changed — prevents reactivity loops
    // when parent re-renders with identical data but new object references
    if (state?.src === options.src) return

    state?.unsubscribe?.()
    const unsubscribe = watchIntersection(el, options)
    stateMap.set(el, { unsubscribe, src: options.src })
  },

  unmounted(el) {
    const state = stateMap.get(el)
    state?.unsubscribe?.()
    stateMap.delete(el)
  },
}
