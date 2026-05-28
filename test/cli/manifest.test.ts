import { describe, it, expect } from 'vitest'
import { generateManifestContent } from '../../src/cli/manifest'
import type { ProcessedImage } from '../../src/cli/types'

const makeImage = (name: string): ProcessedImage => ({
  name,
  srcAbsPath: `/src/${name}.jpg`,
  originalWidth: 1200,
  originalHeight: 800,
  variants: [
    { absPath: `/out/${name}-400.jpg`, url: `/images/${name}-400.jpg`, width: 400,  format: 'jpg'  },
    { absPath: `/out/${name}-800.jpg`, url: `/images/${name}-800.jpg`, width: 800,  format: 'jpg'  },
    { absPath: `/out/${name}.jpg`,     url: `/images/${name}.jpg`,     width: 1200, format: 'jpg'  },
    { absPath: `/out/${name}.webp`,    url: `/images/${name}.webp`,    width: 1200, format: 'webp' },
    { absPath: `/out/${name}.avif`,    url: `/images/${name}.avif`,    width: 1200, format: 'avif' },
  ],
  placeholder: 'data:image/jpeg;base64,/9j/abc',
  blurhash: 'LEHV6nWB2yk8pyo0',
})

describe('generateManifestContent', () => {
  const widths = [400, 800, 1200]
  const content = generateManifestContent([makeImage('photo-1'), makeImage('photo-2')], widths)

  it('starts with the auto-generated comment', () => {
    expect(content.startsWith('// Auto-generated')).toBe(true)
  })

  it('exports an ImageData interface', () => {
    expect(content).toContain('export interface ImageData')
    expect(content).toContain('src400: string')
    expect(content).toContain('src800: string')
    expect(content).toContain('src1200: string')
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
})
