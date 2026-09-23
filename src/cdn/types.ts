export interface CdnAdapter {
  url(path: string, options?: CdnUrlOptions): string
  srcset(path: string, widths: number[], options?: CdnUrlOptions): string
}

export interface CdnUrlOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  dpr?: number
}
