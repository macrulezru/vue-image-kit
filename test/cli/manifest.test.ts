import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { generateManifestContent, buildEntry } from '../../src/cli/manifest'
import type { ProcessedImage } from '../../src/cli/types'

// Type-checks generated manifest source against the ImageData interface it
// exports — the real regression this file guards against isn't a string in
// the output, it's the generated `.ts` module failing `tsc` in a consumer's
// project (the SVG/GIF branches, and any raster width sharp skipped via
// withoutEnlargement, produce object literals missing one or more `src{w}`
// fields; a `required` field there breaks the manifest that just declared it).
function typeCheckDiagnostics(source: string): readonly ts.Diagnostic[] {
  const fileName = 'manifest.generated.ts'
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2020, true)
  const host = ts.createCompilerHost({})
  const originalGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, ...rest) =>
    name === fileName ? sourceFile : originalGetSourceFile(name, ...rest)
  host.writeFile = () => {}
  const program = ts.createProgram(
    [fileName],
    { strict: true, noEmit: true, skipLibCheck: true },
    host,
  )
  return [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)]
}

const makeImage = (name: string): ProcessedImage => ({
  name,
  srcAbsPath: `/src/${name}.jpg`,
  originalWidth: 1200,
  originalHeight: 800,
  originalFormat: 'jpg',
  originalSizeBytes: 245_300,
  variants: [
    { absPath: `/out/${name}-400.jpg`, url: `/images/${name}-400.jpg`, width: 400,  height: 267, format: 'jpg',  sizeBytes: 52_100,  skipped: false },
    { absPath: `/out/${name}-800.jpg`, url: `/images/${name}-800.jpg`, width: 800,  height: 533, format: 'jpg',  sizeBytes: 118_400, skipped: false },
    { absPath: `/out/${name}.jpg`,     url: `/images/${name}.jpg`,     width: 1200, height: 800, format: 'jpg',  sizeBytes: 198_200, skipped: false },
    { absPath: `/out/${name}.webp`,    url: `/images/${name}.webp`,    width: 1200, height: 800, format: 'webp', sizeBytes: 112_900, skipped: false },
    { absPath: `/out/${name}.avif`,    url: `/images/${name}.avif`,    width: 1200, height: 800, format: 'avif', sizeBytes: 79_600,  skipped: false },
  ],
  placeholder: 'data:image/jpeg;base64,/9j/abc',
  blurhash: 'LEHV6nWB2yk8pyo0',
  thumbhash: '',
})

describe('generateManifestContent', () => {
  const widths = [400, 800, 1200]
  const content = generateManifestContent([makeImage('photo-1'), makeImage('photo-2')], widths)

  it('starts with the auto-generated comment', () => {
    expect(content.startsWith('// Auto-generated')).toBe(true)
  })

  it('exports an ImageData interface', () => {
    expect(content).toContain('export interface ImageData')
    expect(content).toContain('src400?: string')
    expect(content).toContain('src800?: string')
    expect(content).toContain('src1200?: string')
    expect(content).toContain('srcset: string')
    expect(content).toContain('placeholder: string')
    expect(content).toContain('blurhash: string')
  })

  it('exports an images array', () => {
    expect(content).toContain('export const images: ImageData[]')
  })

  it('includes entries for each image', () => {
    expect(content).toContain('"photo-1"')
    expect(content).toContain('"photo-2"')
  })

  it('includes srcset string with width descriptors', () => {
    expect(content).toContain('400w')
    expect(content).toContain('800w')
    expect(content).toContain('1200w')
  })

  it('includes placeholder and blurhash values', () => {
    expect(content).toContain('data:image/jpeg;base64,/9j/abc')
    expect(content).toContain('LEHV6nWB2yk8pyo0')
  })

  it('includes webp and avif URLs', () => {
    expect(content).toContain('/images/photo-1.webp')
    expect(content).toContain('/images/photo-1.avif')
  })

  it('generates valid TypeScript (no syntax markers that are wrong)', () => {
    // Basic check: brackets are balanced
    const opens = (content.match(/\[/g) ?? []).length
    const closes = (content.match(/\]/g) ?? []).length
    expect(opens).toBe(closes)
  })

  it('type-checks against its own generated interface', () => {
    const diagnostics = typeCheckDiagnostics(content)
    expect(diagnostics).toEqual([])
  })
})

describe('generateManifestContent — mixed raster/SVG/GIF batch', () => {
  const svgImage: ProcessedImage = {
    name: 'icon',
    srcAbsPath: '/src/icon.svg',
    originalWidth: 64,
    originalHeight: 64,
    originalFormat: 'svg',
    originalSizeBytes: 1_200,
    variants: [{ absPath: '/out/icon.svg', url: '/images/icon.svg', width: 64, height: 64, format: 'svg', sizeBytes: 1_200, skipped: false }],
    placeholder: '',
    blurhash: '',
    thumbhash: '',
  }

  const gifImage: ProcessedImage = {
    name: 'spinner',
    srcAbsPath: '/src/spinner.gif',
    originalWidth: 100,
    originalHeight: 100,
    originalFormat: 'gif',
    originalSizeBytes: 40_000,
    variants: [{ absPath: '/out/spinner.gif', url: '/images/spinner.gif', width: 100, height: 100, format: 'gif', sizeBytes: 40_000, skipped: false }],
    placeholder: '',
    blurhash: 'LEHV6nWB2yk8pyo0',
    thumbhash: '',
  }

  // Original is 400px wide — smaller than the configured 800/1200 widths, so
  // withoutEnlargement means sharp never produced those variants.
  const smallRaster: ProcessedImage = {
    name: 'thumb',
    srcAbsPath: '/src/thumb.jpg',
    originalWidth: 400,
    originalHeight: 300,
    originalFormat: 'jpg',
    originalSizeBytes: 30_000,
    variants: [
      { absPath: '/out/thumb.jpg', url: '/images/thumb.jpg', width: 400, height: 300, format: 'jpg', sizeBytes: 30_000, skipped: false },
    ],
    placeholder: 'data:image/jpeg;base64,/9j/abc',
    blurhash: '',
    thumbhash: '',
  }

  const content = generateManifestContent([svgImage, gifImage, smallRaster], [400, 800, 1200])

  it('omits src{w} fields the SVG/GIF/undersized-raster entries never generated', () => {
    const widths = [400, 800, 1200]
    // SVG/GIF entries have no width-shortcut fields at all.
    expect(buildEntry(svgImage, widths)).not.toHaveProperty('src400')
    expect(buildEntry(svgImage, widths)).not.toHaveProperty('src800')
    expect(buildEntry(gifImage, widths)).not.toHaveProperty('src400')
    // The small raster only ever produced its own original-width variant.
    const thumbEntry = buildEntry(smallRaster, widths)
    expect(thumbEntry).toHaveProperty('src400')
    expect(thumbEntry).not.toHaveProperty('src800')
    expect(thumbEntry).not.toHaveProperty('src1200')
  })

  it('type-checks — this is the actual bug: a required src{w} field would make', () => {
    // these very object literals fail their own generated interface.
    const diagnostics = typeCheckDiagnostics(content)
    expect(diagnostics).toEqual([])
  })
})
