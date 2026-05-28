import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * imgix CDN adapter.
 *
 * @example
 * const cdn = imgix('https://mysite.imgix.net')
 * cdn.url('photo.jpg', { width: 800, format: 'webp' })
 * // → https://mysite.imgix.net/photo.jpg?w=800&fm=webp&auto=format
 *
 * cdn.srcset('photo.jpg', [400, 800, 1200])
 * // → 'https://mysite.imgix.net/photo.jpg?w=400&auto=format 400w, ...'
 */
export function imgix(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const params = new URLSearchParams()

      if (opts.width)   params.set('w', String(opts.width))
      if (opts.height)  params.set('h', String(opts.height))
      if (opts.quality) params.set('q', String(opts.quality))

      if (opts.format && opts.format !== 'auto') {
        params.set('fm', opts.format)
      } else {
        params.set('auto', 'format')
      }

      if (opts.fit) {
        const fitMap: Record<string, string> = { cover: 'crop', contain: 'fill', fill: 'scale' }
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
