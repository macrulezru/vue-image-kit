import { describe, it, expect } from 'vitest'
import { generateSrcset, generateSizes, generateDensitySrcset, buildSizes, generatePreloadLink } from '../../src/utils/srcset'

describe('generateSrcset', () => {
  it('generates srcset string from widths array', () => {
    expect(generateSrcset('/img.jpg', [400, 800, 1200])).toBe(
      '/img.jpg 400w, /img.jpg 800w, /img.jpg 1200w',
    )
  })

  it('returns empty string for empty widths array', () => {
    expect(generateSrcset('/img.jpg', [])).toBe('')
  })

  it('works with a single width', () => {
    expect(generateSrcset('/photo.png', [640])).toBe('/photo.png 640w')
  })

  it('preserves the src as-is', () => {
    expect(generateSrcset('https://cdn.example.com/img.webp', [320])).toBe(
      'https://cdn.example.com/img.webp 320w',
    )
  })
})

describe('generateDensitySrcset', () => {
  it('builds x-descriptors from a single URL', () => {
    expect(generateDensitySrcset('/logo.png', [1, 2, 3])).toBe(
      '/logo.png 1x, /logo.png 2x, /logo.png 3x',
    )
  })

  it('returns empty string for empty densities', () => {
    expect(generateDensitySrcset('/logo.png', [])).toBe('')
  })

  it('works with a single density', () => {
    expect(generateDensitySrcset('/icon.svg', [2])).toBe('/icon.svg 2x')
  })

  it('uses a per-density URL map for distinct files', () => {
    expect(generateDensitySrcset({ 1: '/a.png', 2: '/a@2x.png', 3: '/a@3x.png' }, [1, 2, 3])).toBe(
      '/a.png 1x, /a@2x.png 2x, /a@3x.png 3x',
    )
  })

  it('skips densities missing from the URL map', () => {
    expect(generateDensitySrcset({ 1: '/a.png', 2: '/a@2x.png' }, [1, 2, 3])).toBe(
      '/a.png 1x, /a@2x.png 2x',
    )
  })

  it('supports non-integer densities', () => {
    expect(generateDensitySrcset('/p.jpg', [1, 1.5])).toBe('/p.jpg 1x, /p.jpg 1.5x')
  })
})

describe('generateSizes', () => {
  it('returns passed sizes string unchanged', () => {
    const sizes = '(max-width: 768px) 100vw, 50vw'
    expect(generateSizes(sizes)).toBe(sizes)
  })

  it('returns default "100vw" when sizes is undefined', () => {
    expect(generateSizes(undefined)).toBe('100vw')
  })

  it('returns default "100vw" when called with no argument', () => {
    expect(generateSizes()).toBe('100vw')
  })
})

describe('buildSizes', () => {
  const bp = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }

  it('builds sizes string from breakpoint keys', () => {
    const result = buildSizes({ sm: '100vw', md: '50vw', default: '33vw' }, bp)
    expect(result).toBe('(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw')
  })

  it('puts default (no media condition) last', () => {
    const result = buildSizes({ default: '400px', sm: '100vw' }, bp)
    expect(result.endsWith('400px')).toBe(true)
  })

  it('skips keys not found in breakpoints', () => {
    const result = buildSizes({ unknown: '100vw', sm: '50vw' }, bp)
    expect(result).toBe('(max-width: 640px) 50vw')
  })

  it('returns empty string when no matches and no default', () => {
    const result = buildSizes({ unknown: '100vw' }, bp)
    expect(result).toBe('')
  })

  it('works with empty breakpoints', () => {
    const result = buildSizes({ default: '100vw' }, {})
    expect(result).toBe('100vw')
  })
})

describe('generatePreloadLink', () => {
  it('generates a basic preload link', () => {
    const link = generatePreloadLink('/hero.jpg')
    expect(link).toBe('<link rel="preload" as="image" href="/hero.jpg">')
  })

  it('includes imagesrcset when srcset is provided', () => {
    const link = generatePreloadLink('/hero.jpg', { srcset: '/hero-400.jpg 400w, /hero-800.jpg 800w' })
    expect(link).toContain('imagesrcset=')
    expect(link).toContain('400w')
  })

  it('includes imagesizes when sizes is provided', () => {
    const link = generatePreloadLink('/hero.jpg', { sizes: '100vw' })
    expect(link).toContain('imagesizes="100vw"')
  })

  it('includes type when provided', () => {
    const link = generatePreloadLink('/hero.avif', { type: 'image/avif' })
    expect(link).toContain('type="image/avif"')
  })

  it('includes all attributes together', () => {
    const link = generatePreloadLink('/hero.jpg', {
      srcset: '/hero-400.jpg 400w',
      sizes: '100vw',
      type: 'image/jpeg',
    })
    expect(link).toContain('rel="preload"')
    expect(link).toContain('as="image"')
    expect(link).toContain('href="/hero.jpg"')
    expect(link).toContain('imagesrcset=')
    expect(link).toContain('imagesizes="100vw"')
    expect(link).toContain('type="image/jpeg"')
  })
})
