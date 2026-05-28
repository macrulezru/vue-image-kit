declare module 'sharp' {
  interface Metadata {
    width?: number
    height?: number
    channels?: number
  }

  interface OutputInfo {
    width: number
    height: number
    channels: number
  }

  interface Sharp {
    metadata(): Promise<Metadata>
    clone(): Sharp
    resize(width: number, height?: number | null, options?: { withoutEnlargement?: boolean }): Sharp
    ensureAlpha(alpha?: number): Sharp
    jpeg(options?: { quality?: number; mozjpeg?: boolean }): Sharp
    webp(options?: { quality?: number }): Sharp
    avif(options?: { quality?: number }): Sharp
    raw(): Sharp
    toFile(path: string): Promise<OutputInfo>
    toBuffer(): Promise<Buffer>
    toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: OutputInfo }>
  }

  function sharp(input: string): Sharp
  export = sharp
}
