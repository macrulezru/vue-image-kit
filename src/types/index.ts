export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface SrcSet {
  avif?: string
  webp?: string
  fallback: string
}

export type ResponsiveSrc = Record<string, string | SrcSet>

export type BreakpointMap = Record<string, string>

export interface VImageKitOptions {
  breakpoints?: BreakpointMap
  serverRoute?: string
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
