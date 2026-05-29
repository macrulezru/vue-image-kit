import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Gumlet adapter — query-parameter based (imgix-like API).
 *
 * @example
 * const cdn = gumlet('https://demo.gumlet.io')
 * cdn.url('photo.jpg', { width: 800, format: 'webp' })
 * // → https://demo.gumlet.io/photo.jpg?w=800&format=webp
 */
export function gumlet(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const params = new URLSearchParams()

      if (opts.width)   params.set('w', String(opts.width))
      if (opts.height)  params.set('h', String(opts.height))
      if (opts.quality) params.set('q', String(opts.quality))
      params.set('format', opts.format ?? 'auto')

      if (opts.fit) {
        const fitMap: Record<string, string> = {
          cover: 'crop',
          contain: 'contain',
          fill: 'fill',
          inside: 'clip',
          outside: 'max',
        }
        params.set('fit', fitMap[opts.fit] ?? 'crop')
      }

      if (opts.dpr && opts.dpr !== 1) params.set('dpr', String(opts.dpr))

      const qs = params.toString()
      return `${base}${cleanPath}${qs ? `?${qs}` : ''}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
