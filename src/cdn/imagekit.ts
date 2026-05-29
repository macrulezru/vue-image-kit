import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * ImageKit.io adapter — transformations go in the `tr` query parameter as
 * dash-separated key-value pairs.
 *
 * @example
 * const cdn = imagekit('https://ik.imagekit.io/your_id')
 * cdn.url('photo.jpg', { width: 800, format: 'webp' })
 * // → https://ik.imagekit.io/your_id/photo.jpg?tr=w-800,f-webp
 */
export function imagekit(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const tr: string[] = []

      if (opts.width)   tr.push(`w-${opts.width}`)
      if (opts.height)  tr.push(`h-${opts.height}`)
      if (opts.quality) tr.push(`q-${opts.quality}`)
      tr.push(opts.format ? `f-${opts.format}` : 'f-auto')

      if (opts.fit) {
        // ImageKit crop strategies (c-) / crop modes (cm-)
        const fitMap: Record<string, string> = {
          cover: 'c-maintain_ratio',
          contain: 'cm-pad_resize',
          fill: 'c-force',
          inside: 'c-at_max',
          outside: 'c-at_least',
        }
        tr.push(fitMap[opts.fit] ?? 'c-maintain_ratio')
      }

      if (opts.dpr && opts.dpr !== 1) tr.push(`dpr-${opts.dpr}`)

      return `${base}${cleanPath}?tr=${tr.join(',')}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
