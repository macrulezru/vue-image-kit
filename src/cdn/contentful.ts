import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Contentful Images API adapter.
 *
 * @example
 * const cdn = contentful()
 * cdn.url('https://images.ctfassets.net/space/token/photo.jpg', { width: 800 })
 * // → https://images.ctfassets.net/space/token/photo.jpg?w=800&fm=webp&q=80
 */
export function contentful(): CdnAdapter {
  return {
    url(path, opts: CdnUrlOptions = {}) {
      const url = new URL(path)
      const params = url.searchParams

      if (opts.width)   params.set('w', String(opts.width))
      if (opts.height)  params.set('h', String(opts.height))
      if (opts.quality) params.set('q', String(opts.quality))
      else              params.set('q', '80')

      if (opts.format && opts.format !== 'auto') {
        params.set('fm', opts.format)
      } else {
        params.set('fm', 'webp')
      }

      if (opts.fit) {
        const fitMap: Record<string, string> = { cover: 'fill', contain: 'pad', fill: 'scale' }
        params.set('fit', fitMap[opts.fit] ?? 'fill')
      }

      return url.toString()
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
