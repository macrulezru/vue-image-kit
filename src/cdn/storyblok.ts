import type { CdnAdapter, CdnUrlOptions } from './types.js'

/**
 * Storyblok Image Service adapter.
 *
 * @example
 * const cdn = storyblok()
 * cdn.url('https://a.storyblok.com/f/12345/photo.jpg', { width: 800 })
 * // → https://a.storyblok.com/f/12345/800x0/filters:format(webp)/photo.jpg
 */
export function storyblok(): CdnAdapter {
  function transform(fullUrl: string, opts: CdnUrlOptions = {}): string {
    // Storyblok image URLs look like:
    // https://a.storyblok.com/f/{spaceId}/{filename}
    // Transforms are inserted before the filename:
    // https://a.storyblok.com/f/{spaceId}/{WxH}/filters:format(webp)/{filename}
    const url = new URL(fullUrl)
    const parts = url.pathname.split('/')
    // Find the index after /f/{spaceId}/
    const fIndex = parts.indexOf('f')
    if (fIndex === -1 || fIndex + 2 >= parts.length) return fullUrl

    const beforeFile = parts.slice(0, fIndex + 2)
    const filename = parts.slice(fIndex + 2).join('/')

    const w = opts.width ?? 0
    const h = opts.height ?? 0
    const size = `${w}x${h}`

    const filters: string[] = []
    if (opts.quality) filters.push(`quality(${opts.quality})`)
    if (opts.format && opts.format !== 'auto') filters.push(`format(${opts.format})`)
    else filters.push('format(webp)')

    const filterStr = filters.length > 0 ? `/filters:${filters.join(':')}` : ''
    const transformPath = `${beforeFile.join('/')}/${size}${filterStr}/${filename}`

    return `${url.origin}${transformPath}`
  }

  return {
    url(path, opts = {}) {
      return transform(path, opts)
    },
    srcset(path, widths, opts = {}) {
      return widths
        .map((w) => `${this.url(path, { ...opts, width: w })} ${w}w`)
        .join(', ')
    },
  }
}
