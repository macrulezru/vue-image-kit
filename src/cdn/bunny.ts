import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Bunny CDN adapter (bunny.net Image Processing).
 *
 * @example
 * const cdn = bunny('https://myzone.b-cdn.net')
 * cdn.url('photo.jpg', { width: 800, format: 'webp' })
 * // → https://myzone.b-cdn.net/photo.jpg?width=800&format=webp&quality=80
 */
export function bunny(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const params = new URLSearchParams()

      if (opts.width)   params.set('width', String(opts.width))
      if (opts.height)  params.set('height', String(opts.height))
      if (opts.quality) params.set('quality', String(opts.quality))
      else              params.set('quality', '80')

      if (opts.format && opts.format !== 'auto') {
        params.set('format', opts.format)
      }

      if (opts.fit) {
        const aspectMap: Record<string, string> = { cover: 'true', contain: 'false' }
        params.set('aspect_ratio', aspectMap[opts.fit] ?? 'true')
      }

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
