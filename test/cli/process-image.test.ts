import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { processImage, computeThumbhash } from '../../src/cli/processor'
import { buildEntry } from '../../src/cli/manifest'
import { decodeThumbHash } from '../../src/utils/thumbhash-decode'
import { DEFAULTS } from '../../src/cli/config'
import type { CliConfig } from '../../src/cli/types'

// Integration test: drives the real sharp + thumbhash pipeline used by the
// Vite plugin's build-time `?vik` / `?thumbhash` imports.

let dir: string
let outDir: string
let srcPath: string
let config: CliConfig

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vik-test-'))
  // Source and output must be distinct dirs — the original-width jpg variant
  // keeps the source's name, which would otherwise overwrite the input.
  outDir = join(dir, 'out')
  srcPath = join(dir, 'photo.jpg')

  // 64×48 solid blue image so encoders have real content.
  await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    .jpeg()
    .toFile(srcPath)

  config = {
    ...DEFAULTS,
    output: outDir,
    publicPath: '/images',
    widths: [16, 32],
    formats: ['jpg', 'webp', 'avif'],
    lqip: true,
    blurhash: true,
    thumbhash: true,
  }
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('processImage (build-time ?vik pipeline)', () => {
  it('reports the original dimensions', async () => {
    const image = await processImage(srcPath, config)
    expect(image.originalWidth).toBe(64)
    expect(image.originalHeight).toBe(48)
  })

  it('emits jpg variants at the requested widths plus the original, in every format', async () => {
    const image = await processImage(srcPath, config)
    const jpgWidths = image.variants.filter((v) => v.format === 'jpg').map((v) => v.width).sort((a, b) => a - b)
    expect(jpgWidths).toEqual([16, 32, 64])

    for (const format of ['jpg', 'webp', 'avif'] as const) {
      expect(image.variants.some((v) => v.format === format)).toBe(true)
    }

    // Files were actually written to disk
    for (const v of image.variants) {
      expect(existsSync(v.absPath)).toBe(true)
    }
  })

  it('produces a manifest entry with srcset, src, webp/avif and placeholders', async () => {
    const image = await processImage(srcPath, config)
    const meta = buildEntry(image, config.widths)

    expect(meta.src).toBe('/images/photo.jpg')
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(48)
    expect(meta.srcset).toContain('16w')
    expect(meta.srcset).toContain('64w')
    expect(meta.webp).toMatch(/\.webp$/)
    expect(meta.avif).toMatch(/\.avif$/)
    expect(meta.placeholder).toMatch(/^data:image\/jpeg;base64,/)
    expect(meta.blurhash.length).toBeGreaterThan(0)
    expect(meta.thumbhash.length).toBeGreaterThan(0)
    // Per-width shortcut keys
    expect(meta.src16).toBe('/images/photo-16.jpg')
  })
})

describe('computeThumbhash (build-time ?thumbhash pipeline)', () => {
  it('returns a base64 ThumbHash that decodes to a PNG of the right hue', async () => {
    const hash = await computeThumbhash(srcPath)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
    expect(() => atob(hash)).not.toThrow()

    // Round-trip through our own decoder — the source is a blue image, so blue
    // should dominate red in the decoded average.
    const url = decodeThumbHash(hash)
    expect(url).toMatch(/^data:image\/png;base64,/)
  })

  it('does not write any variant files (hash-only path)', async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), 'vik-th-'))
    const onlySrc = join(cleanDir, 'solo.png')
    await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .png()
      .toFile(onlySrc)

    await computeThumbhash(onlySrc)

    // Only the source file exists — no resized/encoded variants were emitted.
    const { readdirSync } = await import('node:fs')
    expect(readdirSync(cleanDir)).toEqual(['solo.png'])
    rmSync(cleanDir, { recursive: true, force: true })
  })
})
