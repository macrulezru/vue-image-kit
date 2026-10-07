import type { PlaceholderEntry, PlaceholderManifest } from '../types'
import { decodeBlurhash } from './blurhash-decode'
import { decodeThumbHash } from './thumbhash-decode'
import { lookupRegisteredPlaceholder } from './placeholder-registry'
import { hazehashToDataUrl } from './hazehash-decode'

export function lookupManifestEntry(
  manifest: PlaceholderManifest | null | undefined,
  src: string | undefined,
): PlaceholderEntry | undefined {
  if (!src) return undefined
  return manifest?.[src] ?? lookupRegisteredPlaceholder(src)
}

function blurhashToDataUrl(hash: string, width?: number, height?: number): string | undefined {
  const decodeWidth = 32
  const decodeHeight =
    width && height ? Math.max(1, Math.round(decodeWidth * (height / width))) : decodeWidth
  try {
    const pixels = decodeBlurhash(hash, decodeWidth, decodeHeight)
    const canvas = document.createElement('canvas')
    canvas.width = decodeWidth
    canvas.height = decodeHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.putImageData(new ImageData(pixels, decodeWidth, decodeHeight), 0, 0)
    return canvas.toDataURL()
  } catch {
    return undefined
  }
}

export async function entryToImageUrlAsync(
  entry: PlaceholderEntry | undefined,
): Promise<string | undefined> {
  if (entry?.hazehash) {
    const url = await hazehashToDataUrl(entry.hazehash)
    if (url) return url
  }
  return entryToImageUrl(entry)
}

export function entryToImageUrl(entry: PlaceholderEntry | undefined): string | undefined {
  if (!entry || typeof document === 'undefined') return undefined
  if (entry.thumbhash) {
    try {
      return decodeThumbHash(entry.thumbhash)
    } catch {
      return undefined
    }
  }
  if (entry.blurhash) return blurhashToDataUrl(entry.blurhash, entry.width, entry.height)
  return undefined
}
