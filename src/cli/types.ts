export type ImageFormat = 'jpg' | 'webp' | 'avif'

export interface QualityConfig {
  jpg?: number
  webp?: number
  avif?: number
}

export interface CliConfig {
  input: string
  output: string
  widths: number[]
  formats: ImageFormat[]
  quality: QualityConfig
  template: string
  manifest: string | false
  publicPath: string
  lqip: boolean
  blurhash: boolean
  thumbhash: boolean
  clean: boolean
  dryRun: boolean
  concurrency: number
  watch: boolean
  skipExisting: boolean
}

export interface ManifestEntry {
  name: string
  src: string
  srcset: string
  webp: string
  avif: string
  width: number
  height: number
  placeholder: string
  blurhash: string
  thumbhash: string
  [key: string]: string | number
}

export interface ProcessedVariant {
  absPath: string
  url: string
  width: number
  format: ImageFormat
}

export interface ProcessedImage {
  name: string
  srcAbsPath: string
  originalWidth: number
  originalHeight: number
  variants: ProcessedVariant[]
  placeholder: string
  blurhash: string
  thumbhash: string
}
