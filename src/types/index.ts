export type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface SrcSet {
  avif?: string
  webp?: string
  fallback: string
}

// Гибкий словарь: ключ — имя брейкпоинта, значение — URL изображения, либо
// набор форматов ({ avif?, webp?, fallback }) для art direction + format
// switching в одном брейкпоинте.
export type ResponsiveSrc = Record<string, string | SrcSet>

// Словарь брейкпоинтов: ключ — произвольное имя, значение — CSS media query
export type BreakpointMap = Record<string, string>

export interface VImageKitOptions {
  breakpoints?: BreakpointMap
  /** Default route for `VImage`'s `loader="server"` — see `vue-image-kit/server`. Default: `/_vik/image`. Override per-component with the `loaderRoute` prop. */
  serverRoute?: string
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

/**
 * Structural shape of what the CLI/Vite-plugin build-time pipeline produces
 * (a manifest entry or a `?vik` import) — duck-typed on purpose instead of
 * importing `ManifestEntry`/`VikImageMeta` from `src/cli`, so the browser
 * bundle never pulls in CLI/Node code just to describe this shape.
 *
 * Pass it as `<VImage :image="meta" alt="…" />` to seed `src`/`width`/
 * `height`/`blurhash`/`thumbhash`/`placeholder`/`sizes` from build output.
 * Any explicit prop on `VImage` still overrides the corresponding field here.
 */
/**
 * Wrapper sizing preset for `VImage`:
 * - `'fixed'` — exact `width`×`height` box, no responsive scaling.
 * - `'responsive'` — fills the container width, aspect-ratio preserved
 *   (this is also the default when `layout` is unset); auto-generates
 *   `sizes` from `width` when `sizes` isn't given explicitly.
 * - `'fill'` — absolutely fills the parent (`position:absolute; inset:0`),
 *   which must be positioned. `width`/`height` become optional.
 */
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
