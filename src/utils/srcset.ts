export function generateSrcset(src: string, widths: number[]): string {
  if (widths.length === 0) return ''
  return widths.map((w) => `${src} ${w}w`).join(', ')
}

export function generateSizes(sizes?: string): string {
  return sizes ?? '100vw'
}

const SRCSET_WIDTH_CANDIDATE_RE = /(?:,\s*)?(\S+)\s+(\d+)w(?=,|\s|$)/g

export function pickSmallestSrcsetUrl(srcset: string): string | undefined {
  let smallestUrl: string | undefined
  let smallestWidth = Infinity

  for (const [, url, widthStr] of srcset.matchAll(SRCSET_WIDTH_CANDIDATE_RE)) {
    const width = parseInt(widthStr!, 10)
    if (width >= smallestWidth) continue
    smallestWidth = width
    smallestUrl = url
  }

  return smallestUrl
}

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

