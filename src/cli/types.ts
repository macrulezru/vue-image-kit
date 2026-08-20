export type ImageFormat = 'jpg' | 'webp' | 'avif' | 'gif' | 'svg'

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
  /**
   * Skip reprocessing a source file whose mtime (and, if that changed, content
   * hash) matches a persisted record from the last run — cheap for repeated
   * invocations (`--watch`, the Vite plugin's `buildStart`/`handleHotUpdate`),
   * pointless for a single one-shot `generate`. Default `false` here; both of
   * those repeated-invocation call sites default it to `true` themselves
   * unless the user set it explicitly. No effect under `--dry-run`.
   */
  incremental: boolean
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
  height: number
  format: ImageFormat
  /** Output file size in bytes. `-1` when unknown — a `--dry-run` variant that was never actually written. */
  sizeBytes: number
  /** `true` when `--skip-existing` kept a prior file instead of regenerating it. */
  skipped: boolean
}

export interface ProcessedImage {
  name: string
  srcAbsPath: string
  originalWidth: number
  originalHeight: number
  /** Source file extension, lowercased, without the leading dot (e.g. 'jpg', 'png', 'svg'). */
  originalFormat: string
  originalSizeBytes: number
  variants: ProcessedVariant[]
  placeholder: string
  blurhash: string
  thumbhash: string
}
