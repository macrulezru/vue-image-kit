import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Sanity Image CDN adapter.
 *
 * @example
 * const cdn = sanity({ projectId: 'abc123', dataset: 'production' })
 * cdn.url('image-abc123-800x600-jpg', { width: 400 })
 * // → https://cdn.sanity.io/images/abc123/production/image-abc123-800x600-jpg?w=400&auto=format&q=80
 */
export function sanity(options: { projectId: string; dataset: string }): CdnAdapter {
  const { projectId, dataset } = options
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}`

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      const params = new URLSearchParams()

      if (opts.width)   params.set('w', String(opts.width))
      if (opts.height)  params.set('h', String(opts.height))
      if (opts.quality) params.set('q', String(opts.quality))
      else              params.set('q', '80')

      if (opts.format && opts.format !== 'auto') {
        params.set('fm', opts.format)
      } else {
        params.set('auto', 'format')
      }

      if (opts.fit) {
        const fitMap: Record<string, string> = { cover: 'crop', contain: 'fill', fill: 'fillmax' }
        params.set('fit', fitMap[opts.fit] ?? 'crop')
      }

      const qs = params.toString()
      return `${base}/${cleanPath}${qs ? `?${qs}` : ''}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
