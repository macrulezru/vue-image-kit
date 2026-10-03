import { closeSync, openSync, readSync } from 'node:fs'

export interface SvgSize {
  width: number
  height: number
}

const HEAD_BYTES = 8192
const TARGET_SIDE = 256

function parseLength(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(value)
  return match ? Number(match[1]) : undefined
}

export function parseSvgSize(head: string): SvgSize | null {
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0]
  if (!tag) return null
  const attr = (name: string): string | undefined =>
    new RegExp(String.raw`\s${name}\s*=\s*(?:"([^"]*)"|'([^']*)')`, 'i')
      .exec(tag)
      ?.slice(1)
      .find(Boolean)

  let width = parseLength(attr('width'))
  let height = parseLength(attr('height'))
  const box = attr('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if ((!width || !height) && box && box.length === 4 && box[2]! > 0 && box[3]! > 0) {
    const [, , boxWidth, boxHeight] = box as [number, number, number, number]
    if (width) height = (width * boxHeight) / boxWidth
    else if (height) width = (height * boxWidth) / boxHeight
    else {
      width = boxWidth
      height = boxHeight
    }
  }
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return null
  return { width: Math.round(width), height: Math.round(height) }
}

export function readSvgSize(input: string | Buffer): SvgSize | null {
  try {
    if (typeof input !== 'string')
      return parseSvgSize(input.subarray(0, HEAD_BYTES).toString('utf8'))
    const fd = openSync(input, 'r')
    try {
      const buffer = Buffer.alloc(HEAD_BYTES)
      const read = readSync(fd, buffer, 0, HEAD_BYTES, 0)
      return parseSvgSize(buffer.subarray(0, read).toString('utf8'))
    } finally {
      closeSync(fd)
    }
  } catch {
    return null
  }
}

export function svgDensity(size: SvgSize | null): number | undefined {
  if (!size) return undefined
  const longest = Math.max(size.width, size.height)
  if (longest <= TARGET_SIDE) return undefined
  return Math.max(1, Math.floor((72 * TARGET_SIDE) / longest))
}
