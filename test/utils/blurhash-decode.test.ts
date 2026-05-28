import { describe, it, expect } from 'vitest'
import {
  decode83,
  sRGBToLinear,
  linearTosRGB,
  signPow,
  decodeBlurhash,
} from '../../src/utils/blurhash-decode'

describe('decode83', () => {
  it('decodes single character', () => {
    expect(decode83('0', 0, 1)).toBe(0)
    expect(decode83('9', 0, 1)).toBe(9)
    expect(decode83('A', 0, 1)).toBe(10)
  })

  it('decodes multi-character strings', () => {
    expect(decode83('00', 0, 2)).toBe(0)
    expect(decode83('10', 0, 2)).toBe(83)
  })

  it('respects start and end bounds', () => {
    expect(decode83('X0A', 1, 2)).toBe(0)
    expect(decode83('X0A', 2, 3)).toBe(10)
  })

  it('throws on invalid character', () => {
    expect(() => decode83('!', 0, 1)).toThrow('Invalid blurhash character')
  })
})

describe('sRGBToLinear', () => {
  it('converts 0 to 0', () => {
    expect(sRGBToLinear(0)).toBe(0)
  })

  it('converts 255 to ~1', () => {
    expect(sRGBToLinear(255)).toBeCloseTo(1, 5)
  })

  it('uses linear ramp below threshold', () => {
    const val = sRGBToLinear(10)
    expect(val).toBeCloseTo(10 / 255 / 12.92, 5)
  })

  it('uses gamma curve above threshold', () => {
    const val = sRGBToLinear(200)
    expect(val).toBeGreaterThan(0.5)
    expect(val).toBeLessThan(1)
  })
})

describe('linearTosRGB', () => {
  it('converts 0 to 0', () => {
    expect(linearTosRGB(0)).toBe(0)
  })

  it('converts 1 to 255', () => {
    expect(linearTosRGB(1)).toBe(255)
  })

  it('clamps values above 1', () => {
    expect(linearTosRGB(2)).toBe(255)
  })

  it('clamps negative values to 0', () => {
    expect(linearTosRGB(-1)).toBe(0)
  })

  it('round-trips with sRGBToLinear', () => {
    for (const v of [0, 64, 128, 200, 255]) {
      expect(linearTosRGB(sRGBToLinear(v))).toBe(v)
    }
  })
})

describe('signPow', () => {
  it('preserves sign for positive values', () => {
    expect(signPow(2, 2)).toBeCloseTo(4)
  })

  it('preserves sign for negative values', () => {
    expect(signPow(-2, 2)).toBeCloseTo(-4)
  })

  it('handles zero', () => {
    expect(signPow(0, 2)).toBe(0)
  })
})

describe('decodeBlurhash', () => {
  // Valid 28-char blurhash: L=21 → numX=4, numY=3, expectedLen=4+2*12=28
  const KNOWN_HASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

  it('returns Uint8ClampedArray', () => {
    const result = decodeBlurhash(KNOWN_HASH, 4, 3)
    expect(result).toBeInstanceOf(Uint8ClampedArray)
  })

  it('returns correct array size (width * height * 4)', () => {
    const result = decodeBlurhash(KNOWN_HASH, 4, 3)
    expect(result.length).toBe(4 * 3 * 4)
  })

  it('all pixel values are in range 0–255', () => {
    const result = decodeBlurhash(KNOWN_HASH, 8, 8)
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(255)
    }
  })

  it('alpha channel is always 255', () => {
    const result = decodeBlurhash(KNOWN_HASH, 4, 4)
    for (let i = 3; i < result.length; i += 4) {
      expect(result[i]).toBe(255)
    }
  })

  it('throws on too-short hash', () => {
    expect(() => decodeBlurhash('LKO', 4, 4)).toThrow('Invalid blurhash')
  })

  it('throws on wrong-length hash', () => {
    expect(() => decodeBlurhash('LKO2?U%2Tw=w', 4, 4)).toThrow('Invalid blurhash')
  })

  it('works with 1x1 output', () => {
    const result = decodeBlurhash(KNOWN_HASH, 1, 1)
    expect(result.length).toBe(4)
    expect(result[3]).toBe(255)
  })
})
