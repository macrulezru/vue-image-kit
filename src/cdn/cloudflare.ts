import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Cloudflare Images (Image Resizing) adapter — uses the `/cdn-cgi/image/`
 * endpoint with comma-separated options.
 *
 * @example
 * const cdn = cloudflare('https://example.com')
 * cdn.url('/photo.jpg', { width: 800, format: 'webp' })
 * // → https://example.com/cdn-cgi/image/width=800,format=webp/photo.jpg
 */
export function cloudflare(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const parts: string[] = []

      if (opts.width)   parts.push(`width=${opts.width}`)
      if (opts.height)  parts.push(`height=${opts.height}`)
      if (opts.quality) parts.push(`quality=${opts.quality}`)
      parts.push(opts.format ? `format=${opts.format}` : 'format=auto')

      if (opts.fit) {
        const fitMap: Record<string, string> = {
          cover: 'cover',
          contain: 'contain',
          fill: 'crop',
          inside: 'scale-down',
          outside: 'crop',
        }
        parts.push(`fit=${fitMap[opts.fit] ?? 'cover'}`)
      }

      if (opts.dpr && opts.dpr !== 1) parts.push(`dpr=${opts.dpr}`)

      return `${base}/cdn-cgi/image/${parts.join(',')}${cleanPath}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
