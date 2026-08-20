const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i

/**
 * Conservative check for an `alt` that's almost certainly a mistake rather
 * than a deliberate choice. Returns a human-readable reason, or `null` when
 * nothing looks wrong. Kept intentionally narrow — a real `alt=""` (decorative
 * image) must never trigger this; a false positive there is worse than a
 * missed warning.
 */
export function checkAltText(alt: unknown): string | null {
  if (alt === undefined || alt === null) {
    return 'is missing — pass alt="" for a purely decorative image, or real descriptive text otherwise'
  }
  if (typeof alt !== 'string') return null
  if (alt.length === 0) return null // deliberate: the documented way to mark an image decorative
  if (alt.trim().length === 0) {
    return 'is whitespace-only — use alt="" for a decorative image, or write real text'
  }
  if (IMAGE_EXT_RE.test(alt.trim())) {
    return `looks like a filename ("${alt}") — alt text should describe the image, not name the file`
  }
  return null
}

// process.env.NODE_ENV (not import.meta.env.DEV) is deliberate: this file
// ships as part of the published, already-built library. import.meta.env.DEV
// would be statically inlined to `false` at *this package's own* build time
// and stay that way forever. process.env.NODE_ENV survives unminified into
// the shipped dist and gets replaced correctly by whatever bundler the
// *consuming* app uses, at the consumer's own build time — same reason Vue
// core itself checks it. Falls back to not warning when `process` doesn't
// exist at all (a bare, bundler-less browser import).
export function isDevMode(): boolean {
  return typeof process !== 'undefined' && !!process.env && process.env.NODE_ENV !== 'production'
}
