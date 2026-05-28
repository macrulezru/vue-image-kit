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

function encodeDC(r: number, g: number, b: number): number {
  return (linearTosRGB(r) << 16) | (linearTosRGB(g) << 8) | linearTosRGB(b)
}

function signPow(val: number, exp: number): number {
  return Math.sign(val) * Math.pow(Math.abs(val), exp)
}

function encodeAC(r: number, g: number, b: number, maxValue: number): number {
  const qr = Math.max(0, Math.min(18, Math.floor(signPow(r / maxValue, 0.5) * 9 + 9.5)))
  const qg = Math.max(0, Math.min(18, Math.floor(signPow(g / maxValue, 0.5) * 9 + 9.5)))
  const qb = Math.max(0, Math.min(18, Math.floor(signPow(b / maxValue, 0.5) * 9 + 9.5)))
  return qr * 19 * 19 + qg * 19 + qb
}

/**
 * Encodes raw RGB pixel data (3 bytes/pixel, no alpha) to a BlurHash string.
 * For performance, pass a small thumbnail (e.g. 64×64) rather than the full image.
 */
export function encodeBlurhash(
  pixels: Buffer,
  width: number,
  height: number,
  numX = 4,
  numY = 3,
): string {
  const components: [number, number, number][] = []

  for (let j = 0; j < numY; j++) {
    for (let i = 0; i < numX; i++) {
      const norm = i === 0 && j === 0 ? 1 : 2
      let r = 0, g = 0, b = 0

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const basis =
            norm *
            Math.cos((Math.PI * i * x) / width) *
            Math.cos((Math.PI * j * y) / height)
          const idx = (y * width + x) * 3
          r += basis * sRGBToLinear(pixels[idx]!)
          g += basis * sRGBToLinear(pixels[idx + 1]!)
          b += basis * sRGBToLinear(pixels[idx + 2]!)
        }
      }

      const scale = 1 / (width * height)
      components.push([r * scale, g * scale, b * scale])
    }
  }

  const [dc, ...acList] = components as [[number, number, number], ...[number, number, number][]]

  // Max AC value
  const maxAC = acList.reduce(
    (m, [r, g, b]) => Math.max(m, Math.abs(r), Math.abs(g), Math.abs(b)),
    0,
  )
  const quantizedMax = acList.length > 0 ? Math.max(0, Math.min(82, Math.floor(maxAC * 166 - 0.5))) : 0
  const actualMax = acList.length > 0 ? (quantizedMax + 1) / 166 : 1

  let hash = ''
  hash += encode83((numX - 1) + (numY - 1) * 9, 1)
  hash += encode83(quantizedMax, 1)
  hash += encode83(encodeDC(dc[0], dc[1], dc[2]), 4)
  for (const [r, g, b] of acList) {
    hash += encode83(encodeAC(r, g, b, actualMax), 2)
  }

  return hash
}
