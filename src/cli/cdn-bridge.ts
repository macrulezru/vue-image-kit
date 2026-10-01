export interface CdnModule {
  detectCdnProvider(url: string): string | null
  autoLoader(
    url: string,
    options?: { width?: number; format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png' },
  ): string
}

let cached: Promise<CdnModule | null> | null = null

export function loadCdnModule(): Promise<CdnModule | null> {
  if (!cached) {
    const specifier = '@macrulez/vue-image-kit/cdn'
    cached = import(specifier).then(
      (mod) => mod as CdnModule,
      () => null,
    )
  }
  return cached
}
