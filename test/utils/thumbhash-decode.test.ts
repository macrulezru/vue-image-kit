import { describe, it, expect } from 'vitest'
import {
  decodeThumbHash,
  thumbHashToRGBA,
  thumbHashToAverageRGBA,
  thumbHashToAverageColor,
} from '../../src/utils/thumbhash-decode'

// Valid ThumbHash — header bytes: lx=7, ly=3, isLandscape=false → 23×32 px thumbnail.
// This hash decodes to a warm olive image (R≈G>B), NOT a red one.
const KNOWN_HASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

function toBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pixel(rgba: Uint8Array, w: number, x: number, y: number): number[] {
  const i = (y * w + x) * 4
  return [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!]
}

describe('decodeThumbHash', () => {
  it('returns a data:image/png;base64,... URL', () => {
    const result = decodeThumbHash(KNOWN_HASH)
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('accepts a base64 string', () => {
    const result = decodeThumbHash(KNOWN_HASH)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(50)
  })

  it('accepts a Uint8Array', () => {
    const result = decodeThumbHash(toBytes(KNOWN_HASH))
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('produces identical output for string and Uint8Array of the same hash', () => {
    const fromString = decodeThumbHash(KNOWN_HASH)
    const fromBytes = decodeThumbHash(toBytes(KNOWN_HASH))
    expect(fromString).toBe(fromBytes)
  })

  it('returns a valid base64 payload (no non-base64 chars)', () => {
    const result = decodeThumbHash(KNOWN_HASH)
    const payload = result.replace('data:image/png;base64,', '')
    expect(() => atob(payload)).not.toThrow()
  })
})

describe('thumbHashToRGBA — pixel regression (guards the red-cast bug)', () => {
  // Golden values produced by Evan Wallace's reference implementation
  // (github.com/evanw/thumbhash) for KNOWN_HASH. If the YCbCr→RGB formula
  // regresses, these RGB triples drift and the test fails.
  const { w, h, rgba } = thumbHashToRGBA(toBytes(KNOWN_HASH))

  it('decodes to the expected 23×32 thumbnail', () => {
    expect(w).toBe(23)
    expect(h).toBe(32)
    expect(rgba.length).toBe(w * h * 4)
  })

  // Allow ±2 per channel for rounding differences across engines.
  const close = (got: number[], want: number[]) => {
    for (let c = 0; c < 4; c++) expect(Math.abs(got[c]! - want[c]!)).toBeLessThanOrEqual(2)
  }

  it('matches reference RGB at the top-left pixel', () => {
    close(pixel(rgba, w, 0, 0), [117, 113, 93, 255])
  })

  it('matches reference RGB at the center pixel', () => {
    close(pixel(rgba, w, w >> 1, h >> 1), [161, 157, 117, 255])
  })

  it('matches reference RGB at the bottom-right pixel', () => {
    close(pixel(rgba, w, w - 1, h - 1), [125, 121, 44, 255])
  })

  it('matches the reference average RGBA (DC color, no decode)', () => {
    const avg = thumbHashToAverageRGBA(KNOWN_HASH)
    // Reference thumbHashToAverageRGBA values for KNOWN_HASH.
    expect(avg.r).toBeCloseTo(0.5899, 3)
    expect(avg.g).toBeCloseTo(0.5741, 3)
    expect(avg.b).toBeCloseTo(0.4074, 3)
    expect(avg.a).toBe(1)
  })

  it('accepts a Uint8Array and a string identically for the average', () => {
    expect(thumbHashToAverageRGBA(KNOWN_HASH)).toEqual(thumbHashToAverageRGBA(toBytes(KNOWN_HASH)))
  })

  it('thumbHashToAverageColor returns a CSS rgba() string', () => {
    expect(thumbHashToAverageColor(KNOWN_HASH)).toBe('rgba(150, 146, 104, 1.000)')
  })

  it('is a warm olive image, not red — R≈G and both clearly exceed B', () => {
    // The red-cast bug inflated R relative to G/B. Assert the true relationship:
    // average red and green are within ~6% of each other and both well above blue.
    let sumR = 0, sumG = 0, sumB = 0
    const n = w * h
    for (let i = 0; i < n; i++) {
      sumR += rgba[i * 4]!
      sumG += rgba[i * 4 + 1]!
      sumB += rgba[i * 4 + 2]!
    }
    const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n
    expect(Math.abs(avgR - avgG)).toBeLessThan(avgR * 0.06)
    expect(avgR - avgB).toBeGreaterThan(20)
    expect(avgG - avgB).toBeGreaterThan(20)
  })
})
