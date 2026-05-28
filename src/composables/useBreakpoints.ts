import { inject, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { BreakpointMap } from '../types'

export const BREAKPOINTS_KEY: InjectionKey<BreakpointMap> = Symbol('vImageKitBreakpoints')

import type { InjectionKey } from 'vue'

interface MediaSource {
  media: string
  src: string
}

// <picture> берёт первый подходящий source сверху вниз.
// max-width: сортируем по возрастанию (640 → 1024 → …)
// min-width: сортируем по убыванию (1600 → 1025 → …)
// прочие медиа-запросы: сохраняем исходный порядок
function sortSources(sources: MediaSource[]): MediaSource[] {
  const maxWidth: MediaSource[] = []
  const minWidth: MediaSource[] = []
  const other: MediaSource[] = []

  for (const s of sources) {
    if (/max-width/i.test(s.media))      maxWidth.push(s)
    else if (/min-width/i.test(s.media)) minWidth.push(s)
    else                                  other.push(s)
  }

  maxWidth.sort((a, b) => {
    const aw = parseFloat(a.media.match(/max-width\s*:\s*([\d.]+)/)![1]!)
    const bw = parseFloat(b.media.match(/max-width\s*:\s*([\d.]+)/)![1]!)
    return aw - bw
  })

  minWidth.sort((a, b) => {
    const aw = parseFloat(a.media.match(/min-width\s*:\s*([\d.]+)/)![1]!)
    const bw = parseFloat(b.media.match(/min-width\s*:\s*([\d.]+)/)![1]!)
    return bw - aw
  })

  // max-width ascending first (mobile-first), then min-width descending (desktop-first), then other
  return [...maxWidth, ...minWidth, ...other]
}

interface UseBreakpointsReturn {
  merged: ComputedRef<BreakpointMap>
  resolveMediaSources: (sources: Record<string, string> | undefined) => MediaSource[]
}

export function useBreakpoints(localBreakpoints?: BreakpointMap): UseBreakpointsReturn {
  const global = inject<BreakpointMap>(BREAKPOINTS_KEY, {})

  const merged = computed<BreakpointMap>(() => ({
    ...global,
    ...(localBreakpoints ?? {}),
  }))

  function resolveMediaSources(sources: Record<string, string> | undefined): MediaSource[] {
    if (!sources) return []

    const result: MediaSource[] = []
    for (const [key, src] of Object.entries(sources)) {
      const media = merged.value[key]
      if (media) {
        result.push({ media, src })
      }
    }

    return sortSources(result)
  }

  return { merged, resolveMediaSources }
}
