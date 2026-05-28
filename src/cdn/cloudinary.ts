import type { CdnAdapter, CdnUrlOptions } from './types.js'

export interface CloudinaryOptions {
  cloudName: string
  /** Default: 'image/upload' */
  resourceType?: string
}

function buildTransforms(opts: CdnUrlOptions): string {
  const parts: string[] = []
  if (opts.width)   parts.push(`w_${opts.width}`)
  if (opts.height)  parts.push(`h_${opts.height}`)
  if (opts.quality) parts.push(`q_${opts.quality}`)
  else              parts.push('q_auto')
  if (opts.format)  parts.push(opts.format === 'auto' ? 'f_auto' : `f_${opts.format}`)
  else              parts.push('f_auto')
  if (opts.fit) {
    const cropMap: Record<string, string> = { cover: 'fill', contain: 'fit', fill: 'scale' }
    parts.push(`c_${cropMap[opts.fit] ?? 'fill'}`)
  }
  if (opts.dpr && opts.dpr !== 1) parts.push(`dpr_${opts.dpr}`)
  return parts.join(',')
}

/**
 * Cloudinary CDN adapter.
 *
 * @example
 * const cdn = cloudinary({ cloudName: 'my-cloud' })
 * cdn.url('photo.jpg', { width: 800 })
 * // → https://res.cloudinary.com/my-cloud/w_800,q_auto,f_auto/image/upload/photo.jpg
 *
 * cdn.srcset('photo.jpg', [400, 800, 1200])
 * // → 'https://res.cloudinary.com/my-cloud/w_400,q_auto,f_auto/image/upload/photo.jpg 400w, ...'
 */
export function cloudinary(options: CloudinaryOptions): CdnAdapter {
  const { cloudName, resourceType = 'image/upload' } = options
  const base = `https://res.cloudinary.com/${cloudName}`

  return {
    url(path, opts = {}) {
      const transforms = buildTransforms(opts)
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      return `${base}/${transforms}/${resourceType}/${cleanPath}`
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
