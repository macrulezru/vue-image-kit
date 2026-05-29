/**
 * ThumbHash decoder — produces a data:image/png;base64,… URL from a ThumbHash string.
 * Implements the ThumbHash spec: https://github.com/evanw/thumbhash
 *
 * Unlike BlurHash, ThumbHash supports alpha channels and returns a PNG data URL.
 */

// Aspect ratio from the header alone — used to derive output dimensions.
function thumbHashToApproximateAspectRatio(hash: Uint8Array): number {
  const header = hash[3] ?? 0
  const hasAlpha = (hash[2] ?? 0) & 0x80
  const isLandscape = (hash[4] ?? 0) & 0x80
  const lx = isLandscape ? (hasAlpha ? 5 : 7) : header & 7
  const ly = isLandscape ? header & 7 : hasAlpha ? 5 : 7
  return lx / ly
}

/**
 * Faithful port of Evan Wallace's reference `thumbHashToRGBA`
 * (github.com/evanw/thumbhash). AC terms are packed as 4-bit nibbles in a
 * triangular (low-frequency) scan; chroma is boosted 1.25× to offset
 * quantization. Returns the decoded thumbnail as raw RGBA.
 */
export function thumbHashToRGBA(hash: Uint8Array): { w: number; h: number; rgba: Uint8Array } {
  const { PI, min, max, cos, round } = Math
  const at = (i: number): number => hash[i] ?? 0

  // Read the constants
  const header24 = at(0) | (at(1) << 8) | (at(2) << 16)
  const header16 = at(3) | (at(4) << 8)
  const lDC = (header24 & 63) / 63
  const pDC = ((header24 >> 6) & 63) / 31.5 - 1
  const qDC = ((header24 >> 12) & 63) / 31.5 - 1
  const lScale = ((header24 >> 18) & 31) / 31
  const hasAlpha = header24 >> 23
  const pScale = ((header16 >> 3) & 63) / 63
  const qScale = ((header16 >> 9) & 63) / 63
  const isLandscape = header16 >> 15
  const lx = max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7)
  const ly = max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7)
  const aDC = hasAlpha ? (at(5) & 15) / 15 : 1
  const aScale = (at(5) >> 4) / 15

  // Read the varying factors (chroma boosted 1.25× to compensate for quantization)
  const acStart = hasAlpha ? 6 : 5
  let acIndex = 0
  const decodeChannel = (nx: number, ny: number, scale: number): number[] => {
    const ac: number[] = []
    for (let cy = 0; cy < ny; cy++)
      for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++)
        ac.push((((at(acStart + (acIndex >> 1)) >> ((acIndex++ & 1) << 2)) & 15) / 7.5 - 1) * scale)
    return ac
  }
  const lAC = decodeChannel(lx, ly, lScale)
  const pAC = decodeChannel(3, 3, pScale * 1.25)
  const qAC = decodeChannel(3, 3, qScale * 1.25)
  const aAC = hasAlpha ? decodeChannel(5, 5, aScale) : []

  // Decode using the DCT into RGB
  const ratio = thumbHashToApproximateAspectRatio(hash)
  const w = round(ratio > 1 ? 32 : 32 * ratio)
  const h = round(ratio > 1 ? 32 / ratio : 32)
  const rgba = new Uint8Array(w * h * 4)
  const fx: number[] = []
  const fy: number[] = []

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let l = lDC, p = pDC, q = qDC, a = aDC

      // Precompute the cosine coefficients
      for (let cx = 0, n = max(lx, hasAlpha ? 5 : 3); cx < n; cx++)
        fx[cx] = cos((PI / w) * (x + 0.5) * cx)
      for (let cy = 0, n = max(ly, hasAlpha ? 5 : 3); cy < n; cy++)
        fy[cy] = cos((PI / h) * (y + 0.5) * cy)

      // Decode L
      for (let cy = 0, j = 0; cy < ly; cy++)
        for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx * ly < lx * (ly - cy); cx++, j++)
          l += lAC[j]! * fx[cx]! * fy2

      // Decode P and Q
      for (let cy = 0, j = 0; cy < 3; cy++)
        for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx < 3 - cy; cx++, j++) {
          const f = fx[cx]! * fy2
          p += pAC[j]! * f
          q += qAC[j]! * f
        }

      // Decode A
      if (hasAlpha)
        for (let cy = 0, j = 0; cy < 5; cy++)
          for (let cx = cy ? 0 : 1, fy2 = fy[cy]! * 2; cx < 5 - cy; cx++, j++)
            a += aAC[j]! * fx[cx]! * fy2

      // Convert to RGB
      const b = l - (2 / 3) * p
      const r = (3 * l - b + q) / 2
      const g = r - q
      rgba[i]     = max(0, 255 * min(1, r))
      rgba[i + 1] = max(0, 255 * min(1, g))
      rgba[i + 2] = max(0, 255 * min(1, b))
      rgba[i + 3] = max(0, 255 * min(1, a))
    }
  }

  return { w, h, rgba }
}

// Minimal uncompressed PNG encoder (RGBA, no external deps)
function rgbaToPng(w: number, h: number, rgba: Uint8Array): string {
  function crc32(buf: Uint8Array): number {
    let c = 0xffffffff
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    return (c ^ 0xffffffff) >>> 0
  }

  function chunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type)
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(typeBytes, 4)
    out.set(data, 8)
    const forCrc = new Uint8Array(4 + data.length)
    forCrc.set(typeBytes)
    forCrc.set(data, 4)
    dv.setUint32(8 + data.length, crc32(forCrc))
    return out
  }

  // IHDR
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA

  // IDAT: uncompressed zlib store
  const rowSize = 1 + w * 4
  const raw = new Uint8Array(h * rowSize)
  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0  // filter none
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * rowSize + 1)
  }

  function zlibStore(data: Uint8Array): Uint8Array {
    const bs = 32768
    const nb = Math.ceil(data.length / bs)
    const out = new Uint8Array(2 + data.length + nb * 5 + 4)
    out[0] = 0x78; out[1] = 0x01
    let oi = 2, a1 = 1, a2 = 0
    for (let i = 0; i < nb; i++) {
      const s = i * bs, e = Math.min(s + bs, data.length)
      const blk = data.subarray(s, e)
      out[oi++] = i === nb - 1 ? 1 : 0
      out[oi++] = blk.length & 0xff; out[oi++] = (blk.length >> 8) & 0xff
      out[oi++] = ~blk.length & 0xff; out[oi++] = (~blk.length >> 8) & 0xff
      out.set(blk, oi); oi += blk.length
      for (const b of blk) { a1 = (a1 + b) % 65521; a2 = (a2 + a1) % 65521 }
    }
    new DataView(out.buffer).setUint32(oi, ((a2 << 16) | a1) >>> 0)
    return out
  }

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const png = new Uint8Array(total)
  let off = 0
  for (const p of parts) { png.set(p, off); off += p.length }

  let bin = ''
  for (const b of png) bin += String.fromCharCode(b)
  return `data:image/png;base64,${btoa(bin)}`
}

/**
 * Decodes a ThumbHash string (base64 or Uint8Array) to a PNG data URL.
 *
 * @example
 * const dataUrl = decodeThumbHash('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')
 * // → 'data:image/png;base64,...'
 */
function hashToBytes(hash: string | Uint8Array): Uint8Array {
  if (typeof hash !== 'string') return hash
  const bin = atob(hash)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function decodeThumbHash(hash: string | Uint8Array): string {
  const bytes = hashToBytes(hash)
  const { w, h, rgba } = thumbHashToRGBA(bytes)
  return rgbaToPng(w, h, rgba)
}

/**
 * Extracts the average (DC) color of a ThumbHash straight from its header — no
 * pixel decode, no canvas. Channels are returned as 0–1 floats. Faithful port of
 * the reference `thumbHashToAverageRGBA` (github.com/evanw/thumbhash).
 *
 * Ideal as an ultra-cheap solid-color placeholder.
 *
 * @example
 * const { r, g, b, a } = thumbHashToAverageRGBA('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')
 */
export function thumbHashToAverageRGBA(
  hash: string | Uint8Array,
): { r: number; g: number; b: number; a: number } {
  const { min, max } = Math
  const bytes = hashToBytes(hash)
  const header = (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8) | ((bytes[2] ?? 0) << 16)
  const l = (header & 63) / 63
  const p = ((header >> 6) & 63) / 31.5 - 1
  const q = ((header >> 12) & 63) / 31.5 - 1
  const hasAlpha = header >> 23
  const a = hasAlpha ? ((bytes[5] ?? 0) & 15) / 15 : 1
  const b = l - (2 / 3) * p
  const r = (3 * l - b + q) / 2
  const g = r - q
  return {
    r: max(0, min(1, r)),
    g: max(0, min(1, g)),
    b: max(0, min(1, b)),
    a,
  }
}

/**
 * Convenience wrapper around {@link thumbHashToAverageRGBA} that returns a CSS
 * `rgba(...)` string suitable for a `background-color` placeholder.
 */
export function thumbHashToAverageColor(hash: string | Uint8Array): string {
  const { r, g, b, a } = thumbHashToAverageRGBA(hash)
  const to255 = (n: number) => Math.round(n * 255)
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${a.toFixed(3)})`
}
