export interface BuildImageUrlOptions {
  width?: number
  format?: 'jpg' | 'webp' | 'avif' | 'png'
  quality?: number
}

export function buildImageUrl(src: string, opts: BuildImageUrlOptions = {}, base = '/_vik/image'): string {
  const params = new URLSearchParams()
  params.set('src', src)
  if (opts.width) params.set('w', String(opts.width))
  if (opts.format) params.set('format', opts.format)
  if (opts.quality) params.set('q', String(opts.quality))
  return `${base}?${params.toString()}`
}
