import { encodeBlurhash } from '../blurhash-encode.js'
import { hazehashAvailable, type HazehashEncode, type RgbaToThumbHash, type SharpFactory } from '../deps.js'
import { readSvgSize, svgDensity } from './svg.js'

export type PlaceholderMode = 'hazehash' | 'blurhash' | 'thumbhash' | 'color'

export function defaultPlaceholderMode(): PlaceholderMode {
  return hazehashAvailable() ? 'hazehash' : 'blurhash'
}

export interface PlaceholderData {
  hazehash?: string
  blurhash?: string
  thumbhash?: string
  color?: string
  width?: number
  height?: number
  preview?: string
}

export type ColorStrategy = 'dominant' | 'average'

export interface PlaceholderTuning {
  components?: [number, number]
  sample?: number
  color?: ColorStrategy
  budget?: number
}

export interface ResolvedTuning {
  components: [number, number]
  sample: number
  color: ColorStrategy
  budget: number
}

export const DEFAULT_TUNING: ResolvedTuning = {
  components: [4, 3],
  sample: 100,
  color: 'dominant',
  budget: 28,
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function resolveTuning(tuning: PlaceholderTuning = {}): ResolvedTuning {
  return {
    components: [
      clampInt(tuning.components?.[0], 1, 9, DEFAULT_TUNING.components[0]),
      clampInt(tuning.components?.[1], 1, 9, DEFAULT_TUNING.components[1]),
    ],
    sample: clampInt(tuning.sample, 8, 256, DEFAULT_TUNING.sample),
    color: tuning.color === 'average' ? 'average' : 'dominant',
    budget: clampInt(tuning.budget, 7, 48, DEFAULT_TUNING.budget),
  }
}

export function tuningKey(tuning: PlaceholderTuning = {}): string {
  const resolved = resolveTuning(tuning)
  return `${resolved.components.join('x')}|${resolved.sample}|${resolved.color}|${resolved.budget}`
}

export interface ComputeOptions {
  mode: PlaceholderMode
  tuning?: PlaceholderTuning
  sharp: SharpFactory
  rgbaToThumbHash?: RgbaToThumbHash
  encodeHazehash?: HazehashEncode
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

export function averageColor(rgba: Uint8Array, alphaThreshold = 128): string | undefined {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < alphaThreshold) continue
    r += rgba[i]!
    g += rgba[i + 1]!
    b += rgba[i + 2]!
    count++
  }
  if (count === 0) return undefined
  return `#${toHex(r / count)}${toHex(g / count)}${toHex(b / count)}`
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
  const svgSize = options.colorOnly ? readSvgSize(input) : null
  const density = svgDensity(svgSize)
  const open = options.sharp as (
    input: string | Buffer,
    settings?: { density: number },
  ) => ReturnType<SharpFactory>
  const image = density === undefined ? open(input) : open(input, { density })
  const tuning = resolveTuning(options.tuning)
  const data: PlaceholderData = {}

  if (options.includeSize) {
    if (svgSize) {
      data.width = svgSize.width
      data.height = svgSize.height
    } else {
      const meta = await image.metadata()
      if (meta.width && meta.height) {
        data.width = meta.width
        data.height = meta.height
      }
    }
  }

  const side = options.mode === 'thumbhash' ? Math.min(100, tuning.sample) : tuning.sample
  const { data: raw, info } = await image
    .clone()
    .resize(side, side, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)

  const color = tuning.color === 'average' ? averageColor(rgba) : dominantColor(rgba)
  if (color) data.color = color
  if (options.colorOnly) return data

  if (options.mode === 'hazehash' && options.encodeHazehash) {
    data.hazehash = options.encodeHazehash(
      { data: rgba, width: info.width, height: info.height },
      { budget: tuning.budget },
    )
  } else if (options.mode === 'blurhash') {
    data.blurhash = encodeBlurhash(
      rgbaToRgbOverWhite(rgba),
      info.width,
      info.height,
      tuning.components[0],
      tuning.components[1],
    )
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
