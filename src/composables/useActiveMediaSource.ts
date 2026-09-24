import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { MediaSource } from './useBreakpoints'

export function useActiveMediaSource(mediaSources: Ref<MediaSource[]>): Ref<MediaSource | null> {
  const active = ref<MediaSource | null>(null)

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return active
  }

  const mediaQueryLists = new Map<string, MediaQueryList>()

  function findActive(): MediaSource | null {
    for (const source of mediaSources.value) {
      if (mediaQueryLists.get(source.media)?.matches) return source
    }
    return null
  }

  function update(): void {
    active.value = findActive()
  }

  onMounted(() => {
    const sized = mediaSources.value.filter((s) => s.width !== undefined && s.height !== undefined)
    if (sized.length === 0) return

    for (const source of sized) {
      if (mediaQueryLists.has(source.media)) continue
      const mql = window.matchMedia(source.media)
      mediaQueryLists.set(source.media, mql)
      mql.addEventListener('change', update)
    }
    update()
  })

  onUnmounted(() => {
    for (const mql of mediaQueryLists.values()) {
      mql.removeEventListener('change', update)
    }
  })

  return active
}
