import { inject, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { BreakpointMap, ResponsiveSrc } from '../types'

export const BREAKPOINTS_KEY: InjectionKey<BreakpointMap> = Symbol('vImageKitBreakpoints')

import type { InjectionKey } from 'vue'

interface MediaSource {
  media: string
  src: string
  type?: string
}

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

  return [...maxWidth, ...minWidth, ...other]
}

interface UseBreakpointsReturn {
  merged: ComputedRef<BreakpointMap>
  resolveMediaSources: (sources: ResponsiveSrc | undefined) => MediaSource[]
}

export function useBreakpoints(localBreakpoints?: BreakpointMap): UseBreakpointsReturn {
  const global = inject<BreakpointMap>(BREAKPOINTS_KEY, {})

  const merged = computed<BreakpointMap>(() => ({
    ...global,
    ...(localBreakpoints ?? {}),
  }))

  function resolveMediaSources(sources: ResponsiveSrc | undefined): MediaSource[] {
    if (!sources) return []

    const result: MediaSource[] = []
    for (const [key, value] of Object.entries(sources)) {
      const media = merged.value[key]
      if (!media) continue

      if (typeof value === 'string') {
        result.push({ media, src: value })
        continue
      }
      if (value.avif) result.push({ media, src: value.avif, type: 'image/avif' })
      if (value.webp) result.push({ media, src: value.webp, type: 'image/webp' })
      result.push({ media, src: value.fallback })
    }

    return sortSources(result)
  }

  return { merged, resolveMediaSources }
}
