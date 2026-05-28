import { describe, it, expect } from 'vitest'
import { decodeThumbHash } from '../../src/utils/thumbhash-decode'

// Valid ThumbHash — header bytes: lx=7, ly=3, isLandscape=false → ~75×32 px thumbnail
const KNOWN_HASH = 'YQkGHQAnSJlXh4eXh4eEd4iAeA=='

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
    const bin = atob(KNOWN_HASH)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

    const result = decodeThumbHash(bytes)
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('produces identical output for string and Uint8Array of the same hash', () => {
    const fromString = decodeThumbHash(KNOWN_HASH)

    const bin = atob(KNOWN_HASH)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const fromBytes = decodeThumbHash(bytes)

    expect(fromString).toBe(fromBytes)
  })

  it('returns a valid base64 payload (no non-base64 chars)', () => {
    const result = decodeThumbHash(KNOWN_HASH)
    const payload = result.replace('data:image/png;base64,', '')
    expect(() => atob(payload)).not.toThrow()
  })
})
