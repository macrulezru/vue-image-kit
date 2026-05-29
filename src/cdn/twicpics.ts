import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * TwicPics adapter — manipulations go in the `twic` query parameter, joined by
 * slashes after the `v1/` version prefix.
 *
 * @example
 * const cdn = twicpics('https://demo.twic.pics')
 * cdn.url('photo.jpg', { width: 800, format: 'webp' })
 * // → https://demo.twic.pics/photo.jpg?twic=v1/resize=800/output=webp
 */
export function twicpics(baseUrl: string): CdnAdapter {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  return {
    url(path, opts: CdnUrlOptions = {}) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const ops: string[] = []

      // cover needs both dimensions; otherwise resize by the given axes
      if (opts.fit === 'cover' && opts.width && opts.height) {
        ops.push(`cover=${opts.width}x${opts.height}`)
      } else if (opts.width && opts.height) {
        ops.push(`resize=${opts.width}x${opts.height}`)
      } else if (opts.width) {
        ops.push(`resize=${opts.width}`)
      } else if (opts.height) {
        ops.push(`resize=-x${opts.height}`)
      }

      if (opts.dpr && opts.dpr !== 1) ops.push(`dpr=${opts.dpr}`)
      if (opts.quality) ops.push(`quality=${opts.quality}`)
      if (opts.format && opts.format !== 'auto') ops.push(`output=${opts.format}`)

      const twic = `v1${ops.length ? `/${ops.join('/')}` : ''}`
      return `${base}${cleanPath}?twic=${twic}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
