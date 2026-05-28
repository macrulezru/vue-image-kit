export interface CdnAdapter {
  /** Returns a single transformed image URL */
  url(path: string, options?: CdnUrlOptions): string
  /** Returns a ready-made srcset string for the given widths */
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
