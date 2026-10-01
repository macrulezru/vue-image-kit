export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface SrcSet {
  avif?: string
  webp?: string
  fallback: string
}

export interface SourcePlaceholder {
  blurhash?: string
  thumbhash?: string
  placeholder?: string
  placeholderColor?: string
}

export interface ResponsiveSource extends SourcePlaceholder {
  src: string | SrcSet
  width?: number
  height?: number
  srcset?: string
  sizes?: string
}

export type ResponsiveSrcEntry = string | SrcSet | ResponsiveSource | ImageMeta

export type ResponsiveSrc = Record<string, ResponsiveSrcEntry>

export type BreakpointMap = Record<string, string>

export interface PlaceholderEntry {
  blurhash?: string
  thumbhash?: string
  color?: string
  width?: number
  height?: number
}

export type PlaceholderManifest = Record<string, PlaceholderEntry>

export interface VImageKitOptions {
  breakpoints?: BreakpointMap
  serverRoute?: string
  placeholders?: PlaceholderManifest
}

export interface LazyImgOptions {
  src: string
  placeholder?: string
  rootMargin?: string
  threshold?: number
  transition?: string
  onLoad?: () => void
  onError?: (e: Event) => void
}

export type ObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

export type Densities = number[] | Record<number, string>

export interface FocalPoint {
  x: number
  y: number
}

export type Layout = 'fixed' | 'responsive' | 'fill'

export interface ImageMeta {
  src: string
  srcset?: string
  webp?: string
  avif?: string
  width?: number
  height?: number
  placeholder?: string
  blurhash?: string
  thumbhash?: string
  sizes?: string
}
