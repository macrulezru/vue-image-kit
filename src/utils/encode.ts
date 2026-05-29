/**
 * Browser-side encoders — produce a BlurHash or ThumbHash from a `File`/`Blob`,
 * `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap`, or `ImageData`.
 *
 * Use case: user-generated content. When someone uploads a photo you can encode
 * a placeholder on the client and show a blur-up preview instantly — before the
 * full image is processed or uploaded.
 *
 * These require a DOM (canvas) and are therefore browser-only.
 */

export type EncodeSource =
  | ImageData
  | HTMLCanvasElement
  | HTMLImageElement
  | ImageBitmap
  | Blob // includes File

export interface EncodeBlurhashOptions {
  /** Horizontal components (detail), 1–9. Default 4. */
  componentX?: number
  /** Vertical components (detail), 1–9. Default 3. */
  componentY?: number
  /** Longest edge the source is downscaled to before encoding. Default 64. */
  maxSize?: number
}

export interface EncodeThumbHashOptions {
  /** Longest edge the source is downscaled to before encoding. Default/max 100. */
  maxSize?: number
}

// ---------------------------------------------------------------------------
// Source → ImageData
// ---------------------------------------------------------------------------

function assertBrowser(): void {
  if (typeof document === 'undefined') {
    throw new Error('[vue-image-kit] encoders require a browser (DOM) environment')
  }
}

function isImageData(source: EncodeSource): source is ImageData {
  return typeof ImageData !== 'undefined' && source instanceof ImageData
}

function scaledDims(w: number, h: number, maxSize: number): { w: number; h: number } {
  const scale = Math.min(1, maxSize / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

function readScaled(img: CanvasImageSource, sw: number, sh: number, maxSize: number): ImageData {
  const { w, h } = scaledDims(sw, sh, maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[vue-image-kit] could not get a 2D canvas context')
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function imageLoaded(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve, reject) => {
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => reject(new Error('[vue-image-kit] image failed to load')), { once: true })
  })
}

async function sourceToImageData(source: EncodeSource, maxSize: number): Promise<ImageData> {
  assertBrowser()

  if (isImageData(source)) {
    if (Math.max(source.width, source.height) <= maxSize) return source
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    canvas.getContext('2d')!.putImageData(source, 0, 0)
    return readScaled(canvas, source.width, source.height, maxSize)
  }

  if (source instanceof Blob) {
    const bitmap = await createImageBitmap(source)
    try {
      return readScaled(bitmap, bitmap.width, bitmap.height, maxSize)
    } finally {
      bitmap.close()
    }
  }

  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    if (!source.complete || source.naturalWidth === 0) await imageLoaded(source)
    return readScaled(source, source.naturalWidth, source.naturalHeight, maxSize)
  }

  // HTMLCanvasElement | ImageBitmap
  return readScaled(source, source.width as number, source.height as number, maxSize)
}

// ---------------------------------------------------------------------------
// BlurHash
// ---------------------------------------------------------------------------

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

function encode83(value: number, length: number): string {
  let result = ''
  for (let i = 1; i <= length; i++) {
    result += BASE83[Math.floor(value / Math.pow(83, length - i)) % 83]
  }
  return result
}

function sRGBToLinear(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function linearTosRGB(v: number): number {
  const c = Math.max(0, Math.min(1, v))
  return c <= 0.0031308
    ? Math.round(c * 12.92 * 255)
    : Math.round((1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255)
}

function signPow(val: number, exp: number): number {
  return Math.sign(val) * Math.pow(Math.abs(val), exp)
}

function clampComponent(n: number): number {
  return Math.max(1, Math.min(9, Math.round(n)))
}

function blurhashFromImageData(data: ImageData, numX: number, numY: number): string {
  const { data: rgba, width, height } = data
  const factors: [number, number, number][] = []

  for (let j = 0; j < numY; j++) {
    for (let i = 0; i < numX; i++) {
      const norm = i === 0 && j === 0 ? 1 : 2
      let r = 0, g = 0, b = 0
      for (let y = 0; y < height; y++) {
        const fy = Math.cos((Math.PI * j * y) / height)
        for (let x = 0; x < width; x++) {
          const basis = norm * Math.cos((Math.PI * i * x) / width) * fy
          const idx = (y * width + x) * 4
          r += basis * sRGBToLinear(rgba[idx]!)
          g += basis * sRGBToLinear(rgba[idx + 1]!)
          b += basis * sRGBToLinear(rgba[idx + 2]!)
        }
      }
      const scale = 1 / (width * height)
      factors.push([r * scale, g * scale, b * scale])
    }
  }

  const [dc, ...acList] = factors as [[number, number, number], ...[number, number, number][]]

  const maxAC = acList.reduce(
    (m, [r, g, b]) => Math.max(m, Math.abs(r), Math.abs(g), Math.abs(b)),
    0,
  )
  const quantizedMax = acList.length > 0 ? Math.max(0, Math.min(82, Math.floor(maxAC * 166 - 0.5))) : 0
  const actualMax = acList.length > 0 ? (quantizedMax + 1) / 166 : 1

  const encodeAC = (r: number, g: number, b: number): number => {
    const qr = Math.max(0, Math.min(18, Math.floor(signPow(r / actualMax, 0.5) * 9 + 9.5)))
    const qg = Math.max(0, Math.min(18, Math.floor(signPow(g / actualMax, 0.5) * 9 + 9.5)))
    const qb = Math.max(0, Math.min(18, Math.floor(signPow(b / actualMax, 0.5) * 9 + 9.5)))
    return qr * 19 * 19 + qg * 19 + qb
  }

  let hash = ''
  hash += encode83((numX - 1) + (numY - 1) * 9, 1)
  hash += encode83(quantizedMax, 1)
  hash += encode83((linearTosRGB(dc[0]) << 16) | (linearTosRGB(dc[1]) << 8) | linearTosRGB(dc[2]), 4)
  for (const [r, g, b] of acList) hash += encode83(encodeAC(r, g, b), 2)

  return hash
}

/**
 * Encodes a BlurHash string from any supported source.
 *
 * @example
 * const hash = await encodeBlurhash(file)          // from an <input type="file">
 * const hash = await encodeBlurhash(canvas, { componentX: 5, componentY: 4 })
 */
export async function encodeBlurhash(
  source: EncodeSource,
  options: EncodeBlurhashOptions = {},
): Promise<string> {
  const numX = clampComponent(options.componentX ?? 4)
  const numY = clampComponent(options.componentY ?? 3)
  const maxSize = options.maxSize ?? 64
  const data = await sourceToImageData(source, maxSize)
  return blurhashFromImageData(data, numX, numY)
}

// ---------------------------------------------------------------------------
// ThumbHash — faithful port of evanw/thumbhash rgbaToThumbHash
// ---------------------------------------------------------------------------

function rgbaToThumbHash(w: number, h: number, rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  if (w > 100 || h > 100) throw new Error(`[vue-image-kit] ${w}x${h} doesn't fit in 100x100`)
  const { PI, round, max, cos, abs } = Math

  // Average color, premultiplied by alpha
  let avgR = 0, avgG = 0, avgB = 0, avgA = 0
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3]! / 255
    avgR += (alpha / 255) * rgba[j]!
    avgG += (alpha / 255) * rgba[j + 1]!
    avgB += (alpha / 255) * rgba[j + 2]!
    avgA += alpha
  }
  if (avgA) {
    avgR /= avgA
    avgG /= avgA
    avgB /= avgA
  }

  const hasAlpha = avgA < w * h ? 1 : 0
  const lLimit = hasAlpha ? 5 : 7
  const lx = max(1, round((lLimit * w) / max(w, h)))
  const ly = max(1, round((lLimit * h) / max(w, h)))
  const l: number[] = [] // luminance
  const p: number[] = [] // yellow - blue
  const q: number[] = [] // red - green
  const a: number[] = [] // alpha

  // RGBA → LPQA, composited over the average color
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const alpha = rgba[j + 3]! / 255
    const r = avgR * (1 - alpha) + (alpha / 255) * rgba[j]!
    const g = avgG * (1 - alpha) + (alpha / 255) * rgba[j + 1]!
    const b = avgB * (1 - alpha) + (alpha / 255) * rgba[j + 2]!
    l[i] = (r + g + b) / 3
    p[i] = (r + g) / 2 - b
    q[i] = r - g
    a[i] = alpha
  }

  // DCT → DC + normalized AC terms
  const encodeChannel = (channel: number[], nx: number, ny: number): [number, number[], number] => {
    let dc = 0
    const ac: number[] = []
    let scale = 0
    const fx: number[] = []
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx * ny < nx * (ny - cy); cx++) {
        let f = 0
        for (let x = 0; x < w; x++) fx[x] = cos((PI / w) * cx * (x + 0.5))
        for (let y = 0; y < h; y++) {
          const fy = cos((PI / h) * cy * (y + 0.5))
          for (let x = 0; x < w; x++) f += channel[x + y * w]! * fx[x]! * fy
        }
        f /= w * h
        if (cx || cy) {
          ac.push(f)
          scale = max(scale, abs(f))
        } else {
          dc = f
        }
      }
    }
    if (scale) for (let i = 0; i < ac.length; i++) ac[i] = 0.5 + (0.5 / scale) * ac[i]!
    return [dc, ac, scale]
  }

  const [lDC, lAC, lScale] = encodeChannel(l, max(3, lx), max(3, ly))
  const [pDC, pAC, pScale] = encodeChannel(p, 3, 3)
  const [qDC, qAC, qScale] = encodeChannel(q, 3, 3)
  const alphaCh = hasAlpha ? encodeChannel(a, 5, 5) : [1, [], 1]
  const [aDC, aAC, aScale] = alphaCh as [number, number[], number]

  const isLandscape = w > h ? 1 : 0
  const header24 =
    round(63 * lDC) |
    (round(31.5 + 31.5 * pDC) << 6) |
    (round(31.5 + 31.5 * qDC) << 12) |
    (round(31 * lScale) << 18) |
    (hasAlpha << 23)
  const header16 =
    (isLandscape ? ly : lx) | (round(63 * pScale) << 3) | (round(63 * qScale) << 9) | (isLandscape << 15)
  const hash: number[] = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8]
  const acStart = hasAlpha ? 6 : 5
  let acIndex = 0
  if (hasAlpha) hash.push(round(15 * aDC) | (round(15 * aScale) << 4))

  const channels = hasAlpha ? [lAC, pAC, qAC, aAC] : [lAC, pAC, qAC]
  for (const ac of channels) {
    for (const f of ac) {
      const k = acStart + (acIndex >> 1)
      hash[k] = (hash[k] ?? 0) | (round(15 * f) << ((acIndex & 1) << 2))
      acIndex++
    }
  }

  return new Uint8Array(hash)
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Encodes a base64 ThumbHash string from any supported source. The image is
 * downscaled to fit within 100×100 first (a ThumbHash requirement).
 *
 * @example
 * const hash = await encodeThumbHash(file)
 * // pass straight to <VImage :thumbhash="hash"> or decodeThumbHash(hash)
 */
export async function encodeThumbHash(
  source: EncodeSource,
  options: EncodeThumbHashOptions = {},
): Promise<string> {
  const maxSize = Math.min(100, options.maxSize ?? 100)
  const data = await sourceToImageData(source, maxSize)
  return bytesToBase64(rgbaToThumbHash(data.width, data.height, data.data))
}
