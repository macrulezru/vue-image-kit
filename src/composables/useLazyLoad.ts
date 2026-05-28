import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { observeShared } from '../utils/observer-pool'

interface UseLazyLoadOptions {
  rootMargin?: string
  threshold?: number
}

interface UseLazyLoadReturn {
  isIntersecting: Ref<boolean>
  observe: (el: Ref<HTMLElement | null>) => void
}

export function useLazyLoad(options: UseLazyLoadOptions = {}): UseLazyLoadReturn {
  const { rootMargin = '200px', threshold = 0 } = options
  const isIntersecting = ref(false)

  if (typeof window === 'undefined') {
    isIntersecting.value = true
    return { isIntersecting, observe: () => {} }
  }

  let unsubscribe: (() => void) | null = null

  function observe(elRef: Ref<HTMLElement | null>): void {
    unsubscribe?.()
    unsubscribe = null

    const doObserve = () => {
      const el = elRef.value
      if (!el) return
      unsubscribe = observeShared(el, rootMargin, threshold, () => {
        isIntersecting.value = true
        unsubscribe = null
      })
    }

    // observe() may be called in setup() before the element is mounted.
    // Defer to the next microtask so the ref has time to be populated.
    if (elRef.value) {
      doObserve()
    } else {
      Promise.resolve().then(doObserve)
    }
  }

  onUnmounted(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  return { isIntersecting, observe }
}
