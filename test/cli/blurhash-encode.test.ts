import { describe, it, expect } from 'vitest'
import { encodeBlurhash } from '../../src/cli/blurhash-encode'

// 4×4 pixels of solid red (RGB, 3 bytes per pixel)
function solidRed(w: number, h: number): Buffer {
  const buf = Buffer.alloc(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = 255   // R
    buf[i * 3 + 1] = 0 // G
    buf[i * 3 + 2] = 0 // B
  }
  return buf
}

// 4×4 pixels of solid white
function solidWhite(w: number, h: number): Buffer {
  return Buffer.alloc(w * h * 3, 255)
}

// 4×4 pixels of solid black
function solidBlack(w: number, h: number): Buffer {
  return Buffer.alloc(w * h * 3, 0)
}

describe('encodeBlurhash', () => {
  it('returns a non-empty string', () => {
    const hash = encodeBlurhash(solidRed(4, 4), 4, 4)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })

  it('returns different hashes for different colors', () => {
    const hashRed = encodeBlurhash(solidRed(4, 4), 4, 4)
    const hashWhite = encodeBlurhash(solidWhite(4, 4), 4, 4)
    const hashBlack = encodeBlurhash(solidBlack(4, 4), 4, 4)
    expect(hashRed).not.toBe(hashWhite)
    expect(hashRed).not.toBe(hashBlack)
    expect(hashWhite).not.toBe(hashBlack)
  })

  it('is deterministic — same input produces same hash', () => {
    const pixels = solidRed(8, 8)
    expect(encodeBlurhash(pixels, 8, 8)).toBe(encodeBlurhash(pixels, 8, 8))
  })

  it('uses only valid base83 characters', () => {
    const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
    const validChars = new Set(BASE83)
    const hash = encodeBlurhash(solidRed(16, 16), 16, 16)
    for (const ch of hash) {
      expect(validChars.has(ch)).toBe(true)
    }
  })

  it('respects custom component counts (numX, numY)', () => {
    const hash1 = encodeBlurhash(solidRed(4, 4), 4, 4, 4, 3)
    const hash2 = encodeBlurhash(solidRed(4, 4), 4, 4, 2, 2)
    expect(hash1).not.toBe(hash2)
  })

  it('handles 1×1 image', () => {
    const buf = Buffer.from([200, 100, 50])
    expect(() => encodeBlurhash(buf, 1, 1, 1, 1)).not.toThrow()
  })
})
