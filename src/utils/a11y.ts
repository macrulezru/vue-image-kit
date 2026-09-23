const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i

export function checkAltText(alt: unknown): string | null {
  if (alt === undefined || alt === null) {
    return 'is missing — pass alt="" for a purely decorative image, or real descriptive text otherwise'
  }
  if (typeof alt !== 'string') return null
  if (alt.length === 0) return null
  if (alt.trim().length === 0) {
    return 'is whitespace-only — use alt="" for a decorative image, or write real text'
  }
  if (IMAGE_EXT_RE.test(alt.trim())) {
    return `looks like a filename ("${alt}") — alt text should describe the image, not name the file`
  }
  return null
}

export function isDevMode(): boolean {
  return typeof process !== 'undefined' && !!process.env && process.env.NODE_ENV !== 'production'
}
