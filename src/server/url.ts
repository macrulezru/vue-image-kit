export interface BuildImageUrlOptions {
  width?: number
  format?: 'jpg' | 'webp' | 'avif' | 'png'
  quality?: number
}

/**
 * Builds a request URL for `createImageHandler` (or the Vite dev on-demand
 * middleware) from a source path and transform options.
 *
 * @example
 * buildImageUrl('/photos/cat.jpg', { width: 800, format: 'webp' })
 * // → '/_vik/image?src=%2Fphotos%2Fcat.jpg&w=800&format=webp'
 */
export function buildImageUrl(src: string, opts: BuildImageUrlOptions = {}, base = '/_vik/image'): string {
  const params = new URLSearchParams()
  params.set('src', src)
  if (opts.width) params.set('w', String(opts.width))
  if (opts.format) params.set('format', opts.format)
  if (opts.quality) params.set('q', String(opts.quality))
  return `${base}?${params.toString()}`
}
