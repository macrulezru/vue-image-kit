import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { MediaSource } from './useBreakpoints'

function isSized(source: MediaSource): boolean {
  return source.width !== undefined && source.height !== undefined
}

export function useActiveMediaSource(
  mediaSources: Ref<MediaSource[]>,
  isTracked: (source: MediaSource) => boolean = isSized,
): Ref<MediaSource | null> {
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
    const tracked = mediaSources.value.filter(isTracked)
    if (tracked.length === 0) return

    for (const source of tracked) {
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
