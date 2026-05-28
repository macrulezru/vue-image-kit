import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Vercel Image Optimization adapter.
 * Works on Vercel deployments; uses the /_vercel/image endpoint.
 *
 * @example
 * const cdn = vercel({ origin: 'https://myapp.vercel.app' })
 * cdn.url('/photo.jpg', { width: 800, quality: 75 })
 * // → https://myapp.vercel.app/_vercel/image?url=%2Fphoto.jpg&w=800&q=75
 */
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
