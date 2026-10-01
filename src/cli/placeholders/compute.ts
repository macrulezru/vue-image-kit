import { encodeBlurhash } from '../blurhash-encode.js'
import type { RgbaToThumbHash, SharpFactory } from '../deps.js'

export type PlaceholderMode = 'blurhash' | 'thumbhash' | 'color'

export interface PlaceholderData {
  blurhash?: string
  thumbhash?: string
  color?: string
  width?: number
  height?: number
}

export interface ComputeOptions {
  mode: PlaceholderMode
  sharp: SharpFactory
  rgbaToThumbHash?: RgbaToThumbHash
  includeSize: boolean
  colorOnly: boolean
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

export function dominantColor(rgba: Uint8Array, alphaThreshold = 128): string | undefined {
  const counts = new Uint32Array(4096)
  const sums = new Float64Array(4096 * 3)
  let best = -1
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < alphaThreshold) continue
    const r = rgba[i]!
    const g = rgba[i + 1]!
    const b = rgba[i + 2]!
    const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    counts[bin]!++
    sums[bin * 3] += r
    sums[bin * 3 + 1] += g
    sums[bin * 3 + 2] += b
    if (best < 0 || counts[bin]! > counts[best]!) best = bin
  }
  if (best < 0) return undefined
  const count = counts[best]!
  return `#${toHex(sums[best * 3]! / count)}${toHex(sums[best * 3 + 1]! / count)}${toHex(sums[best * 3 + 2]! / count)}`
}

export function rgbaToRgbOverWhite(rgba: Uint8Array): Buffer {
  const rgb = Buffer.alloc((rgba.length / 4) * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const alpha = rgba[i + 3]! / 255
    rgb[j] = Math.round(rgba[i]! * alpha + 255 * (1 - alpha))
    rgb[j + 1] = Math.round(rgba[i + 1]! * alpha + 255 * (1 - alpha))
    rgb[j + 2] = Math.round(rgba[i + 2]! * alpha + 255 * (1 - alpha))
  }
  return rgb
}

export async function computePlaceholder(
  input: string | Buffer,
  options: ComputeOptions,
): Promise<PlaceholderData> {
  const image = options.sharp(input)
  const data: PlaceholderData = {}

  if (options.includeSize) {
    const meta = await image.metadata()
    if (meta.width && meta.height) {
      data.width = meta.width
      data.height = meta.height
    }
  }

  const { data: raw, info } = await image
    .clone()
    .resize(100, 100, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)

  const color = dominantColor(rgba)
  if (color) data.color = color
  if (options.colorOnly) return data

  if (options.mode === 'blurhash') {
    data.blurhash = encodeBlurhash(rgbaToRgbOverWhite(rgba), info.width, info.height)
  } else if (options.mode === 'thumbhash' && options.rgbaToThumbHash) {
    data.thumbhash = Buffer.from(options.rgbaToThumbHash(info.width, info.height, rgba)).toString(
      'base64',
    )
  }
  return data
}

export async function probeSize(
  sharp: SharpFactory,
  input: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(input).metadata()
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null
  } catch {
    return null
  }
}
