export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface SrcSet {
  avif?: string
  webp?: string
  fallback: string
}

// Гибкий словарь: ключ — имя брейкпоинта, значение — URL изображения
export type ResponsiveSrc = Record<string, string>

// Словарь брейкпоинтов: ключ — произвольное имя, значение — CSS media query
export type BreakpointMap = Record<string, string>

export interface VImageKitOptions {
  breakpoints?: BreakpointMap
}

export interface LazyImgOptions {
  src: string
  placeholder?: string
  rootMargin?: string
  threshold?: number
  /** CSS transition duration for the background-image swap, e.g. '0.4s ease' */
  transition?: string
  onLoad?: () => void
  onError?: (e: Event) => void
}

export type ObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

/**
 * Density descriptors for `srcset`. Either a list of densities that reuse the
 * single `src` (for resolution-aware/CDN URLs), or a map of density → distinct
 * URL (a real 2×/3× asset per density).
 *
 * @example [1, 2, 3]
 * @example { 1: '/a.png', 2: '/a@2x.png', 3: '/a@3x.png' }
 */
export type Densities = number[] | Record<number, string>

/**
 * Focal point for cropping, as fractions of width/height in the range 0–1.
 * `{ x: 0.5, y: 0.5 }` is the center (the browser default). With `fit="cover"`
 * this maps to CSS `object-position`, keeping the point of interest in frame.
 */
export interface FocalPoint {
  x: number
  y: number
}
