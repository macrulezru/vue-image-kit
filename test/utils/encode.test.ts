import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { rgbaToThumbHash as refRgbaToThumbHash } from 'thumbhash'
import { encodeBlurhash, encodeThumbHash } from '../../src/utils/encode'
import { encodeBlurhash as cliEncodeBlurhash } from '../../src/cli/blurhash-encode'
import { decodeThumbHash } from '../../src/utils/thumbhash-decode'
import { decodeBlurhash } from '../../src/utils/blurhash-decode'

// jsdom provides neither ImageData nor createImageBitmap. Polyfill a minimal
// ImageData so `instanceof ImageData` holds; passing maxSize >= dimensions makes
// the encoders use the pixels directly (no canvas needed).
class FakeImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}

beforeAll(() => {
  vi.stubGlobal('ImageData', FakeImageData)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const W = 16
const H = 12

// A deterministic opaque RGBA gradient.
function makeRGBA(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      rgba[i] = Math.round((x / (W - 1)) * 255)       // R ramps across
      rgba[i + 1] = Math.round((y / (H - 1)) * 255)   // G ramps down
      rgba[i + 2] = 96                                // constant B
      rgba[i + 3] = 255
    }
  }
  return rgba
}

function rgbaToRgbBuffer(rgba: Uint8ClampedArray): Buffer {
  const rgb = Buffer.alloc(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = rgba[i * 4]!
    rgb[i * 3 + 1] = rgba[i * 4 + 1]!
    rgb[i * 3 + 2] = rgba[i * 4 + 2]!
  }
  return rgb
}

function imageData(rgba: Uint8ClampedArray): ImageData {
  return new (ImageData as unknown as typeof FakeImageData)(rgba, W, H) as unknown as ImageData
}

describe('encodeThumbHash', () => {
  it('produces byte-identical output to the reference thumbhash encoder', async () => {
    const rgba = makeRGBA()
    const refBytes = refRgbaToThumbHash(W, H, rgba)
    const refBase64 = Buffer.from(refBytes).toString('base64')

    const hash = await encodeThumbHash(imageData(rgba), { maxSize: W })
    expect(hash).toBe(refBase64)
  })

  it('round-trips through our decoder to a valid PNG', async () => {
    const hash = await encodeThumbHash(imageData(makeRGBA()), { maxSize: W })
    expect(decodeThumbHash(hash)).toMatch(/^data:image\/png;base64,/)
  })

  it('handles alpha (RGBA with transparency) without throwing', async () => {
    const rgba = makeRGBA()
    for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = i % 2 === 0 ? 255 : 0
    const hash = await encodeThumbHash(imageData(rgba), { maxSize: W })
    expect(hash.length).toBeGreaterThan(0)
    expect(decodeThumbHash(hash)).toMatch(/^data:image\/png;base64,/)
  })
})

describe('encodeBlurhash', () => {
  it('matches the CLI BlurHash encoder for the same pixels and components', async () => {
    const rgba = makeRGBA()
    const cliHash = cliEncodeBlurhash(rgbaToRgbBuffer(rgba), W, H, 4, 3)
    const hash = await encodeBlurhash(imageData(rgba), { componentX: 4, componentY: 3, maxSize: W })
    expect(hash).toBe(cliHash)
  })

  it('encodes a string that our decoder accepts', async () => {
    const hash = await encodeBlurhash(imageData(makeRGBA()), { maxSize: W })
    const pixels = decodeBlurhash(hash, 32, 32)
    expect(pixels.length).toBe(32 * 32 * 4)
  })

  it('reflects component counts in the first base83 char', async () => {
    // size flag = (numX-1) + (numY-1)*9; for 5x4 → 4 + 27 = 31 → base83 char 'V'
    const hash = await encodeBlurhash(imageData(makeRGBA()), { componentX: 5, componentY: 4, maxSize: W })
    const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
    expect(hash[0]).toBe(BASE83[31])
  })

  it('clamps out-of-range component counts to 1–9', async () => {
    const hash = await encodeBlurhash(imageData(makeRGBA()), { componentX: 99, componentY: 0, maxSize: W })
    // clamped to 9 and 1 → size flag = 8 + 0 = 8
    const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
    expect(hash[0]).toBe(BASE83[8])
  })
})
