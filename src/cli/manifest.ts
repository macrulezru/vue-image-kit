import type { ProcessedImage, ManifestEntry } from './types.js'

function buildSrcset(image: ProcessedImage): string {
  const jpgVariants = image.variants.filter((v) => v.format === 'jpg')
  // sort by width ascending
  jpgVariants.sort((a, b) => a.width - b.width)
  return jpgVariants.map((v) => `${v.url} ${v.width}w`).join(', ')
}

export function buildEntry(image: ProcessedImage, widths: number[]): ManifestEntry {
  // SVG passthrough — a single vector variant; no responsive/format variants apply.
  const svgVariant = image.variants.find((v) => v.format === 'svg')
  if (svgVariant) {
    return {
      name: image.name,
      src: svgVariant.url,
      srcset: '',
      webp: '',
      avif: '',
      width: image.originalWidth,
      height: image.originalHeight,
      placeholder: '',
      blurhash: '',
      thumbhash: '',
    }
  }

  // Animated GIF — original copied through as `src`, optional animated WebP
  // re-encode as `webp`. No srcset/avif (see buildGifVariants for why).
  const gifVariant = image.variants.find((v) => v.format === 'gif')
  if (gifVariant) {
    const webpVariant = image.variants.find((v) => v.format === 'webp')
    return {
      name: image.name,
      src: gifVariant.url,
      srcset: '',
      webp: webpVariant?.url ?? '',
      avif: '',
      width: image.originalWidth,
      height: image.originalHeight,
      placeholder: image.placeholder,
      blurhash: image.blurhash,
      thumbhash: image.thumbhash,
    }
  }

  const jpgByWidth = new Map(
    image.variants.filter((v) => v.format === 'jpg').map((v) => [v.width, v.url]),
  )
  const webpOriginal = image.variants.find(
    (v) => v.format === 'webp' && v.width === image.originalWidth,
  )
  const avifOriginal = image.variants.find(
    (v) => v.format === 'avif' && v.width === image.originalWidth,
  )

  const entry: ManifestEntry = {
    name: image.name,
    src: jpgByWidth.get(image.originalWidth) ?? image.variants.find((v) => v.format === 'jpg')?.url ?? '',
    srcset: buildSrcset(image),
    webp: webpOriginal?.url ?? '',
    avif: avifOriginal?.url ?? '',
    width: image.originalWidth,
    height: image.originalHeight,
    placeholder: image.placeholder,
    blurhash: image.blurhash,
    thumbhash: image.thumbhash,
  }

  // Add src{width} shortcuts for each requested width
  for (const w of widths) {
    if (jpgByWidth.has(w)) {
      entry[`src${w}`] = jpgByWidth.get(w)!
    }
  }

  return entry
}

function indent(obj: ManifestEntry): string {
  return JSON.stringify(obj, null, 4)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n')
}

function buildInterface(widths: number[]): string {
  // Optional, not required: the SVG/GIF branches of buildEntry() return
  // before this loop runs at all, and a raster image smaller than a given
  // width never gets that width's variant (sharp's withoutEnlargement skips
  // it) — either way, the generated object literal for that entry legally
  // lacks the field, so a required `string` would make TypeScript reject the
  // very manifest this function just wrote.
  const widthFields = widths.map((w) => `  src${w}?: string`).join('\n')
  return [
    'export interface ImageData {',
    '  name: string',
    '  src: string',
    widthFields,
    '  srcset: string',
    '  webp: string',
    '  avif: string',
    '  width: number',
    '  height: number',
    '  placeholder: string',
    '  blurhash: string',
    '  thumbhash: string',
    '}',
  ].join('\n')
}

export function generateManifestContent(images: ProcessedImage[], widths: number[]): string {
  const entries = images
    .map((img) => `  ${indent(buildEntry(img, widths))}`)
    .join(',\n')

  return [
    '// Auto-generated — do not edit manually',
    buildInterface(widths),
    '',
    `export const images: ImageData[] = [`,
    entries,
    ']',
    '',
  ].join('\n')
}
