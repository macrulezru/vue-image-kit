import type { CdnAdapter, CdnUrlOptions } from './types.js'

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
