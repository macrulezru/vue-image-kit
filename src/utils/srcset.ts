export function generateSrcset(src: string, widths: number[]): string {
  if (widths.length === 0) return ''
  return widths.map((w) => `${src} ${w}w`).join(', ')
}

export function generateSizes(sizes?: string): string {
  return sizes ?? '100vw'
}

/**
 * Builds a density-descriptor srcset (`1x`, `2x`, …) for fixed-size images —
 * icons, avatars, logos — where width-based candidates don't apply.
 *
 * Pass either a single URL (same asset at every density; useful when the URL
 * itself encodes DPR via a CDN) or a per-density URL map for distinct files.
 * Density (`x`) and width (`w`) descriptors must not be mixed in one srcset.
 *
 * @example
 * generateDensitySrcset('/logo.png', [1, 2, 3])
 * // → '/logo.png 1x, /logo.png 2x, /logo.png 3x'
 *
 * generateDensitySrcset({ 1: '/a.png', 2: '/a@2x.png' }, [1, 2])
 * // → '/a.png 1x, /a@2x.png 2x'
 */
export function generateDensitySrcset(
  src: string | Record<number, string>,
  densities: number[],
): string {
  if (densities.length === 0) return ''
  return densities
    .map((d) => {
      const url = typeof src === 'string' ? src : src[d]
      return url ? `${url} ${d}x` : null
    })
    .filter((entry): entry is string => entry !== null)
    .join(', ')
}

/**
 * Builds a `sizes` attribute string from a breakpoint-keyed object.
 * The `'default'` key becomes the trailing fallback (no media condition).
 *
 * @example
 * buildSizes(
 *   { sm: '100vw', md: '50vw', default: '33vw' },
 *   { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }
 * )
 * // → '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
 */
export function buildSizes(
  sizes: Record<string, string>,
  breakpoints: Record<string, string> = {},
): string {
  const parts: string[] = []
  let fallback = ''

  for (const [key, value] of Object.entries(sizes)) {
    if (key === 'default') {
      fallback = value
      continue
    }
    const media = breakpoints[key]
    if (media) parts.push(`${media} ${value}`)
  }

  if (fallback) parts.push(fallback)
  return parts.join(', ')
}

/**
 * Generates an HTML `<link rel="preload">` string for a critical above-the-fold image.
 * Pass the output to Nuxt's `useHead` or inject into SSR `<head>`.
 *
 * @example
 * generatePreloadLink('/hero.jpg', { srcset: '/hero-400.jpg 400w, /hero-800.jpg 800w', sizes: '100vw' })
 * // → '<link rel="preload" as="image" href="/hero.jpg" imagesrcset="..." imagesizes="100vw">'
 */
export function generatePreloadLink(
  href: string,
  options: { srcset?: string; sizes?: string; type?: string } = {},
): string {
  const attrs: string[] = [`rel="preload"`, `as="image"`, `href="${href}"`]
  if (options.srcset) attrs.push(`imagesrcset="${options.srcset}"`)
  if (options.sizes)  attrs.push(`imagesizes="${options.sizes}"`)
  if (options.type)   attrs.push(`type="${options.type}"`)
  return `<link ${attrs.join(' ')}>`
}

