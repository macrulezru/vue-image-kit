import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Netlify Image CDN adapter — uses the `/.netlify/images` endpoint.
 *
 * @example
 * const cdn = netlify({ origin: 'https://myapp.netlify.app' })
 * cdn.url('/photo.jpg', { width: 800, format: 'webp', quality: 75 })
 * // → https://myapp.netlify.app/.netlify/images?url=%2Fphoto.jpg&w=800&fm=webp&q=75
 */
export function netlify(options: { origin?: string } = {}): CdnAdapter {
  const origin = options.origin ?? ''

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const params = new URLSearchParams()
      params.set('url', path)

      if (opts.width)   params.set('w', String(opts.width))
      if (opts.height)  params.set('h', String(opts.height))
      if (opts.format && opts.format !== 'auto') params.set('fm', opts.format)
      if (opts.quality) params.set('q', String(opts.quality))

      if (opts.fit) {
        const fitMap: Record<string, string> = {
          cover: 'cover',
          contain: 'contain',
          fill: 'fill',
          inside: 'contain',
          outside: 'cover',
        }
        params.set('fit', fitMap[opts.fit] ?? 'cover')
      }

      return `${origin}/.netlify/images?${params.toString()}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
