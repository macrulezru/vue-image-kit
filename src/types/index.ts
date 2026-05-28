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
