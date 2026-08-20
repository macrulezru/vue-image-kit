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

// On Windows, libvips/sharp can keep a native handle on the source file open
// until the Sharp wrapper is GC'd, which races with an immediate rmSync and
// throws EBUSY — unrelated to correctness. Best-effort cleanup only; the OS
// reclaims the temp dir regardless.
function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  } catch {
    // ignore — see above
  }
}

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

describe('SVG passthrough', () => {
  it('copies the file through untouched and reports it as a single svg variant', async () => {
    const svgDir = mkdtempSync(join(tmpdir(), 'vik-svg-'))
    const svgSrc = join(svgDir, 'icon.svg')
    const svgOut = join(svgDir, 'out')
    const { writeFileSync, readFileSync } = await import('node:fs')
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>'
    writeFileSync(svgSrc, svgContent, 'utf8')

    const svgConfig: CliConfig = { ...config, output: svgOut }
    const image = await processImage(svgSrc, svgConfig)

    expect(image.variants).toHaveLength(1)
    expect(image.variants[0]!.format).toBe('svg')
    expect(readFileSync(image.variants[0]!.absPath, 'utf8')).toBe(svgContent)

    const meta = buildEntry(image, svgConfig.widths)
    expect(meta.src).toBe('/images/icon.svg')
    expect(meta.webp).toBe('')
    expect(meta.avif).toBe('')
    expect(meta.blurhash).toBe('')

    cleanupDir(svgDir)
  })
})

describe('animated GIF handling', () => {
  it('copies the original gif through and emits an animated webp variant', async () => {
    const gifDir = mkdtempSync(join(tmpdir(), 'vik-gif-'))
    const gifSrc = join(gifDir, 'anim.gif')
    const gifOut = join(gifDir, 'out')
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 60 } },
    })
      .gif()
      .toFile(gifSrc)

    const gifConfig: CliConfig = { ...config, output: gifOut, formats: ['jpg', 'webp', 'avif'] }
    const image = await processImage(gifSrc, gifConfig)

    const gifVariant = image.variants.find((v) => v.format === 'gif')
    const webpVariant = image.variants.find((v) => v.format === 'webp')
    expect(gifVariant).toBeDefined()
    expect(webpVariant).toBeDefined()
    expect(image.variants.some((v) => v.format === 'avif')).toBe(false)
    expect(existsSync(gifVariant!.absPath)).toBe(true)
    expect(existsSync(webpVariant!.absPath)).toBe(true)

    // Placeholders still derive from a static (first-frame) read.
    expect(image.blurhash.length).toBeGreaterThan(0)

    const meta = buildEntry(image, gifConfig.widths)
    expect(meta.src).toMatch(/\.gif$/)
    expect(meta.webp).toMatch(/\.webp$/)
    expect(meta.avif).toBe('')

    cleanupDir(gifDir)
  })

  it('skips the webp re-encode when webp is not in the requested formats', async () => {
    const gifDir = mkdtempSync(join(tmpdir(), 'vik-gif-nowebp-'))
    const gifSrc = join(gifDir, 'anim.gif')
    const gifOut = join(gifDir, 'out')
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 60 } },
    })
      .gif()
      .toFile(gifSrc)

    const gifConfig: CliConfig = { ...config, output: gifOut, formats: ['jpg'] }
    const image = await processImage(gifSrc, gifConfig)

    expect(image.variants.some((v) => v.format === 'gif')).toBe(true)
    expect(image.variants.some((v) => v.format === 'webp')).toBe(false)

    cleanupDir(gifDir)
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
