import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolve } from 'node:path'
import { printImageReport, printBatchSummary } from '../../src/cli/report'
import type { ProcessedImage } from '../../src/cli/types'

function makeImage(overrides: Partial<ProcessedImage> = {}): ProcessedImage {
  return {
    name: 'photo1',
    srcAbsPath: resolve(process.cwd(), 'images/photo1.jpg'),
    originalWidth: 1200,
    originalHeight: 800,
    originalFormat: 'jpg',
    originalSizeBytes: 245_300,
    variants: [
      {
        absPath: resolve(process.cwd(), 'out/photo1-400.jpg'),
        url: '/images/photo1-400.jpg',
        width: 400,
        height: 267,
        format: 'jpg',
        sizeBytes: 52_100,
        skipped: false,
      },
      {
        absPath: resolve(process.cwd(), 'out/photo1.webp'),
        url: '/images/photo1.webp',
        width: 1200,
        height: 800,
        format: 'webp',
        sizeBytes: 112_900,
        skipped: false,
      },
    ],
    placeholder: '',
    blurhash: '',
    thumbhash: '',
    ...overrides,
  }
}

let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  logSpy.mockRestore()
})

function loggedLines(): string {
  return logSpy.mock.calls.map((args) => args.join(' ')).join('\n')
}

describe('printImageReport', () => {
  it('prints the image name, input line, and dimensions/format/size', () => {
    printImageReport(makeImage())
    const out = loggedLines()
    expect(out).toContain('photo1')
    expect(out).toContain('./images/photo1.jpg')
    expect(out).toContain('jpg · 1200×800 · 239.6 KB')
  })

  it('prints one aligned line per variant with path/format/dimensions/size', () => {
    printImageReport(makeImage())
    const out = loggedLines()
    expect(out).toContain('./out/photo1-400.jpg')
    expect(out).toContain('jpg')
    expect(out).toContain('400×267')
    expect(out).toContain('50.9 KB')
    expect(out).toContain('./out/photo1.webp')
    expect(out).toContain('webp')
    expect(out).toContain('1200×800')
    expect(out).toContain('110.3 KB')
  })

  it('marks skip-existing variants as (existing)', () => {
    printImageReport(makeImage({
      variants: [{
        absPath: resolve(process.cwd(), 'out/photo1-400.jpg'),
        url: '/images/photo1-400.jpg',
        width: 400,
        height: 267,
        format: 'jpg',
        sizeBytes: 52_100,
        skipped: true,
      }],
    }))
    expect(loggedLines()).toContain('(existing)')
  })

  it('shows a dash and a dry-run note for unwritten (sizeBytes = -1) variants', () => {
    printImageReport(makeImage({
      variants: [{
        absPath: resolve(process.cwd(), 'out/photo1-400.jpg'),
        url: '/images/photo1-400.jpg',
        width: 400,
        height: 267,
        format: 'jpg',
        sizeBytes: -1,
        skipped: false,
      }],
    }))
    const out = loggedLines()
    expect(out).toContain('—')
    expect(out).toContain('dry-run')
    expect(out).not.toContain('(existing)')
  })

  it('does not print an Output section when there are no variants', () => {
    printImageReport(makeImage({ variants: [] }))
    expect(loggedLines()).not.toContain('Output')
  })

  it('renders paths relative to cwd with a leading ./', () => {
    printImageReport(makeImage())
    const out = loggedLines()
    expect(out).not.toContain(process.cwd())
    expect(out).toMatch(/\.\/images\/photo1\.jpg/)
  })
})

describe('printBatchSummary', () => {
  it('reports image count and total variant count across all images', () => {
    printBatchSummary([makeImage(), makeImage({ name: 'photo2', variants: [] })])
    expect(loggedLines()).toContain('Done. 2 image(s) → 2 file(s).')
  })

  it('reports zero files for an empty batch', () => {
    printBatchSummary([])
    expect(loggedLines()).toContain('Done. 0 image(s) → 0 file(s).')
  })

  it('prints total input/output size and the smallest-format savings vs. original', () => {
    printBatchSummary([makeImage()])
    const out = loggedLines()
    // originalSizeBytes 245_300 → 239.6 KB; variants 52_100 + 112_900 → 161.1 KB
    expect(out).toContain('Input:  1 image(s), 239.6 KB total')
    expect(out).toContain('Output: 2 file(s), 161.1 KB total')
    // smallest variant is 52_100 vs original 245_300 → saves ~79%
    expect(out).toContain('Smallest available format saves ~79% vs. original, on average')
  })

  it('switches to MB once totals cross 1 MB', () => {
    printBatchSummary([makeImage({
      originalSizeBytes: 5 * 1024 * 1024,
      variants: [{
        absPath: '/out/big.webp', url: '/images/big.webp', width: 1200, height: 800,
        format: 'webp', sizeBytes: 2 * 1024 * 1024, skipped: false,
      }],
    })])
    const out = loggedLines()
    expect(out).toContain('5.00 MB total')
    expect(out).toContain('2.00 MB total')
  })

  it('adds no size lines when nothing has a known size (all dry-run)', () => {
    printBatchSummary([makeImage({
      originalSizeBytes: -1,
      variants: [{
        absPath: '/out/photo1-400.jpg', url: '/images/photo1-400.jpg', width: 400, height: 267,
        format: 'jpg', sizeBytes: -1, skipped: false,
      }],
    })])
    expect(loggedLines()).not.toContain('Input:')
  })

  it('does not claim "saves" when the smallest format is larger than the original', () => {
    printBatchSummary([makeImage({
      originalSizeBytes: 1000,
      variants: [{
        absPath: '/out/photo1.png', url: '/images/photo1.png', width: 1200, height: 800,
        format: 'jpg', sizeBytes: 5000, skipped: false,
      }],
    })])
    const out = loggedLines()
    expect(out).toContain('is ~400% bigger than the original, on average')
  })
})
