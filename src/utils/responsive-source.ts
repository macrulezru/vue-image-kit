import type { ResponsiveSrcEntry, SrcSet } from '../types'

export interface NormalizedResponsiveEntry {
  formats: SrcSet
  width?: number
  height?: number
  srcset?: string
  sizes?: string
}

export function normalizeResponsiveEntry(entry: ResponsiveSrcEntry): NormalizedResponsiveEntry {
  if (typeof entry === 'string') {
    return { formats: { fallback: entry } }
  }

  if ('fallback' in entry) {
    return { formats: entry }
  }

  const { width, height, srcset, sizes } = entry

  if (typeof entry.src === 'object') {
    return {
      formats: entry.src,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(srcset !== undefined ? { srcset } : {}),
      ...(sizes !== undefined ? { sizes } : {}),
    }
  }

  const avif = 'avif' in entry ? entry.avif : undefined
  const webp = 'webp' in entry ? entry.webp : undefined

  return {
    formats: {
      ...(avif ? { avif } : {}),
      ...(webp ? { webp } : {}),
      fallback: entry.src,
    },
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(srcset !== undefined ? { srcset } : {}),
    ...(sizes !== undefined ? { sizes } : {}),
  }
}
