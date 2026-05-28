/**
 * ThumbHash decoder — produces a data:image/png;base64,… URL from a ThumbHash string.
 * Implements the ThumbHash spec: https://github.com/evanw/thumbhash
 *
 * Unlike BlurHash, ThumbHash supports alpha channels and returns a PNG data URL.
 */

function thumbHashToRGBA(hash: Uint8Array): { w: number; h: number; rgba: Uint8Array } {
  // Header is packed into the first 5 bytes
  const h24 = hash[0]! | (hash[1]! << 8) | (hash[2]! << 16)
  const h16 = hash[3]! | (hash[4]! << 8)

  const lDC     = (h24 & 63) / 63
  const pDC     = ((h24 >> 6) & 63) / 31.5 - 1
  const qDC     = ((h24 >> 12) & 63) / 31.5 - 1
  const lScale  = ((h24 >> 18) & 31) / 31
  const hasAlpha = (h24 >> 23) & 1
  const pScale  = ((h16 >> (hasAlpha ? 6 : 0)) & 63) / 63 * lScale
  const qScale  = ((h16 >> (hasAlpha ? 12 : 6)) & 63) / 63 * lScale
  const isLandscape = (h16 >> 15) & 1

  // Number of DCT frequency components per direction
  const lx = Math.max(3, isLandscape ? (hasAlpha ? 5 : 7) - (h16 & 7) : (h16 & 7) + 2)
  const ly = Math.max(3, isLandscape ? (h16 & 7) + 2 : (hasAlpha ? 5 : 7) - (h16 & 7))

  // Image dimensions (max 32 px on the longer side)
  const w = isLandscape ? 32 : Math.max(1, Math.round(32 * lx / ly))
  const h = isLandscape ? Math.max(1, Math.round(32 * ly / lx)) : 32

  // Bit reader — starts after the 5-byte header
  let ptr = 40
  function readBits(n: number): number {
    let v = 0
    for (let i = 0; i < n; i++) {
      v |= ((hash[ptr >> 3]! >> (ptr & 7)) & 1) << i
      ptr++
    }
    return v
  }

  // Alpha DC
  const aDC = hasAlpha ? readBits(6) / 63 : 1

  // Luma AC  (DC is lDC; AC indices start at 1)
  const lAC: number[] = []
  const lCount = lx * ly
  for (let i = 1; i < lCount; i++) lAC.push(readBits(6) / 31.5 - 1)

  // Cb (p) AC
  const pAC: number[] = []
  const pCount = Math.ceil(lx / 2) * Math.ceil(ly / 2)
  for (let i = 0; i < pCount; i++) pAC.push(readBits(6) / 31.5 - 1)

  // Cr (q) AC
  const qAC: number[] = []
  for (let i = 0; i < pCount; i++) qAC.push(readBits(6) / 31.5 - 1)

  // Alpha AC
  let aScale = 1
  const aAC: number[] = []
  if (hasAlpha) {
    aScale = readBits(4) / 15
    const aCount = Math.ceil(lx / 2) * Math.ceil(ly / 2)
    for (let i = 1; i < aCount; i++) aAC.push((readBits(4) / 7.5 - 1) * aScale)
  }

  // Render RGBA pixels
  const rgba = new Uint8Array(w * h * 4)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let l = lDC, p = pDC, q = qDC, a = aDC

      // Luma: full lx×ly grid, skip DC (cx=0,cy=0)
      let li = 0
      for (let cy = 0; cy < ly; cy++) {
        const fyL = Math.cos((Math.PI / h) * (y + 0.5) * cy)
        for (let cx = cy > 0 ? 0 : 1; cx < lx; cx++) {
          l += lScale * lAC[li++]! * Math.cos((Math.PI / w) * (x + 0.5) * cx) * fyL
        }
      }

      // Chroma: ceil(lx/2) × ceil(ly/2) grid
      const cx2 = Math.ceil(lx / 2)
      const cy2 = Math.ceil(ly / 2)
      let pi = 0, qi = 0, ai = 0

      for (let cy = 0; cy < cy2; cy++) {
        const fyC = Math.cos((Math.PI / h) * (y + 0.5) * cy)
        for (let cx = 0; cx < cx2; cx++) {
          const fxC = Math.cos((Math.PI / w) * (x + 0.5) * cx)
          p += pScale * pAC[pi++]! * fxC * fyC
          q += qScale * qAC[qi++]! * fxC * fyC
        }
      }

      // Alpha
      if (hasAlpha) {
        for (let cy = 0; cy < cy2; cy++) {
          const fyA = Math.cos((Math.PI / h) * (y + 0.5) * cy)
          for (let cx = cy > 0 ? 0 : 1; cx < cx2; cx++) {
            a += aAC[ai++]! * Math.cos((Math.PI / w) * (x + 0.5) * cx) * fyA
          }
        }
      }

      // YCbCr → RGB  (reference: github.com/evanw/thumbhash)
      const bMid = l - 2 / 3 * p
      const rr   = Math.max(0, bMid + q)
      const gg   = Math.max(0, bMid - q)
      const bb   = Math.max(0, bMid)

      const idx = (y * w + x) * 4
      rgba[idx]     = Math.min(255, Math.round(rr * 255))
      rgba[idx + 1] = Math.min(255, Math.round(gg * 255))
      rgba[idx + 2] = Math.min(255, Math.round(bb * 255))
      rgba[idx + 3] = Math.min(255, Math.round(Math.max(0, a) * 255))
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
export function decodeThumbHash(hash: string | Uint8Array): string {
  let bytes: Uint8Array
  if (typeof hash === 'string') {
    const bin = atob(hash)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else {
    bytes = hash
  }
  const { w, h, rgba } = thumbHashToRGBA(bytes)
  return rgbaToPng(w, h, rgba)
}
