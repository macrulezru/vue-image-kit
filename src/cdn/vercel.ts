import type { CdnAdapter, CdnUrlOptions } from './types.js'

export function vercel(options: { origin?: string } = {}): CdnAdapter {
  const origin = options.origin ?? ''

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const params = new URLSearchParams()
      params.set('url', path)
      if (opts.width) params.set('w', String(opts.width))
      params.set('q', String(opts.quality ?? 75))
      return `${origin}/_vercel/image?${params.toString()}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
