import { inject, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { InjectionKey } from 'vue'
import type { BreakpointMap, ResponsiveSrc } from '../types'
import { normalizeResponsiveEntry } from '../utils/responsive-source'
import { isDevMode } from '../utils/a11y'

export const BREAKPOINTS_KEY: InjectionKey<BreakpointMap> = Symbol('vImageKitBreakpoints')

export interface MediaSource {
  media: string
  src: string
  type?: string
  width?: number
  height?: number
  sizes?: string
}

function sortSources(sources: MediaSource[]): MediaSource[] {
  const maxWidth: MediaSource[] = []
  const minWidth: MediaSource[] = []
  const other: MediaSource[] = []

  for (const s of sources) {
    if (/max-width/i.test(s.media)) maxWidth.push(s)
    else if (/min-width/i.test(s.media)) minWidth.push(s)
    else other.push(s)
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
      if (!media) {
        if (isDevMode()) {
          const available = Object.keys(merged.value).join(', ') || 'none registered'
          console.warn(
            `[vue-image-kit] VImage: sources key "${key}" has no matching breakpoint (available: ${available})`,
          )
        }
        continue
      }

      const {
        formats,
        width: rawWidth,
        height: rawHeight,
        srcset,
        sizes,
      } = normalizeResponsiveEntry(value)

      let width: number | undefined
      let height: number | undefined
      if (rawWidth !== undefined && rawHeight !== undefined) {
        width = rawWidth
        height = rawHeight
      } else if ((rawWidth !== undefined) !== (rawHeight !== undefined)) {
        if (isDevMode()) {
          console.warn(
            `[vue-image-kit] VImage: sources key "${key}" sets only one of width/height — both are required, so neither is applied to <source>`,
          )
        }
      }

      const dims = {
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(sizes !== undefined ? { sizes } : {}),
      }

      if (formats.avif) result.push({ media, src: formats.avif, type: 'image/avif', ...dims })
      if (formats.webp) result.push({ media, src: formats.webp, type: 'image/webp', ...dims })
      result.push({ media, src: srcset ?? formats.fallback, ...dims })
    }

    return sortSources(result)
  }

  return { merged, resolveMediaSources }
}
