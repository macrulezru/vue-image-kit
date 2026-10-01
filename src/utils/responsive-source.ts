import type { ResponsiveSrcEntry, SourcePlaceholder, SrcSet } from '../types'

export interface NormalizedResponsiveEntry {
  formats: SrcSet
  width?: number
  height?: number
  srcset?: string
  sizes?: string
  placeholder?: SourcePlaceholder
}

const PLACEHOLDER_FIELDS = ['blurhash', 'thumbhash', 'placeholder', 'placeholderColor'] as const

function pickPlaceholder(entry: object): SourcePlaceholder | undefined {
  const picked: SourcePlaceholder = {}
  for (const field of PLACEHOLDER_FIELDS) {
    const value = (entry as Record<string, unknown>)[field]
    if (typeof value === 'string' && value !== '') picked[field] = value
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}

export function normalizeResponsiveEntry(entry: ResponsiveSrcEntry): NormalizedResponsiveEntry {
  if (typeof entry === 'string') {
    return { formats: { fallback: entry } }
  }

  if ('fallback' in entry) {
    return { formats: entry }
  }

  const { width, height, srcset, sizes } = entry
  const placeholder = pickPlaceholder(entry)

  if (typeof entry.src === 'object') {
    return {
      formats: entry.src,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(srcset !== undefined ? { srcset } : {}),
      ...(sizes !== undefined ? { sizes } : {}),
      ...(placeholder ? { placeholder } : {}),
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
    ...(placeholder ? { placeholder } : {}),
  }
}
