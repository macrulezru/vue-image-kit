import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

interface UseImagePreloaderReturn {
  loaded: Ref<number>
  total: ComputedRef<number>
  progress: ComputedRef<number>
  isComplete: ComputedRef<boolean>
  errors: Ref<string[]>
  preload: (urls: string[]) => Promise<void>
}

/**
 * Preloads a batch of images before navigation (e.g. next slide in a gallery).
 *
 * @example
 * const { preload, progress, isComplete } = useImagePreloader()
 *
 * onMounted(async () => {
 *   await preload(['/slide-1.jpg', '/slide-2.jpg', '/slide-3.jpg'])
 * })
 */
export function useImagePreloader(): UseImagePreloaderReturn {
  const loaded = ref(0)
  const totalCount = ref(0)
  const errors = ref<string[]>([])

  const total = computed(() => totalCount.value)
  const progress = computed(() =>
    totalCount.value === 0 ? 0 : Math.round((loaded.value / totalCount.value) * 100),
  )
  const isComplete = computed(() => totalCount.value > 0 && loaded.value === totalCount.value)

  function preload(urls: string[]): Promise<void> {
    if (urls.length === 0) return Promise.resolve()

    loaded.value = 0
    totalCount.value = urls.length
    errors.value = []

    return new Promise((resolve) => {
      let settled = 0

      function settle() {
        settled++
        if (settled === urls.length) resolve()
      }

      for (const url of urls) {
        const img = new Image()
        img.onload = () => {
          loaded.value++
          settle()
        }
        img.onerror = () => {
          errors.value.push(url)
          loaded.value++
          settle()
        }
        img.src = url
      }
    })
  }

  return { loaded, total, progress, isComplete, errors, preload }
}
