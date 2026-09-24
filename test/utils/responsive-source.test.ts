import { describe, it, expect } from 'vitest'
import { normalizeResponsiveEntry } from '../../src/utils/responsive-source'
import type { ImageMeta, ResponsiveSource, SrcSet } from '../../src/types'

describe('normalizeResponsiveEntry', () => {
  it('normalizes a plain URL string to a fallback-only SrcSet', () => {
    expect(normalizeResponsiveEntry('/tablet.jpg')).toEqual({
      formats: { fallback: '/tablet.jpg' },
    })
  })

  it('normalizes a SrcSet as-is, with no width/height/srcset/sizes', () => {
    const srcSet: SrcSet = { avif: '/t.avif', webp: '/t.webp', fallback: '/t.jpg' }
    expect(normalizeResponsiveEntry(srcSet)).toEqual({ formats: srcSet })
  })

  it('normalizes a ResponsiveSource whose src is a plain string', () => {
    const entry: ResponsiveSource = { src: '/tablet.jpg', width: 1400, height: 700, sizes: '100vw' }
    expect(normalizeResponsiveEntry(entry)).toEqual({
      formats: { fallback: '/tablet.jpg' },
      width: 1400,
      height: 700,
      sizes: '100vw',
    })
  })

  it('normalizes a ResponsiveSource whose src is a SrcSet, keeping width/height alongside it', () => {
    const entry: ResponsiveSource = {
      src: { webp: '/t.webp', fallback: '/t.jpg' },
      width: 1400,
      height: 700,
    }
    expect(normalizeResponsiveEntry(entry)).toEqual({
      formats: { webp: '/t.webp', fallback: '/t.jpg' },
      width: 1400,
      height: 700,
    })
  })

  it('normalizes a ResponsiveSource srcset onto the result, for the fallback <source> to use', () => {
    const entry: ResponsiveSource = {
      src: '/tablet.jpg',
      srcset: '/t-400.jpg 400w, /t-800.jpg 800w',
    }
    expect(normalizeResponsiveEntry(entry)).toEqual({
      formats: { fallback: '/tablet.jpg' },
      srcset: '/t-400.jpg 400w, /t-800.jpg 800w',
    })
  })

  it('normalizes an ImageMeta the same way as a string-src ResponsiveSource, picking up avif/webp', () => {
    const image: ImageMeta = {
      src: '/tablet.jpg',
      avif: '/tablet.avif',
      webp: '/tablet.webp',
      width: 1400,
      height: 700,
      srcset: '/t-400.jpg 400w',
      sizes: '100vw',
    }
    expect(normalizeResponsiveEntry(image)).toEqual({
      formats: { avif: '/tablet.avif', webp: '/tablet.webp', fallback: '/tablet.jpg' },
      width: 1400,
      height: 700,
      srcset: '/t-400.jpg 400w',
      sizes: '100vw',
    })
  })

  it('normalizes an ImageMeta with no avif/webp to a fallback-only SrcSet', () => {
    const image: ImageMeta = { src: '/tablet.jpg', width: 1400, height: 700 }
    expect(normalizeResponsiveEntry(image)).toEqual({
      formats: { fallback: '/tablet.jpg' },
      width: 1400,
      height: 700,
    })
  })

  it('omits width/height/srcset/sizes entirely when the entry has none of them', () => {
    const entry: ResponsiveSource = { src: '/tablet.jpg' }
    const result = normalizeResponsiveEntry(entry)
    expect(result).toEqual({ formats: { fallback: '/tablet.jpg' } })
    expect('width' in result).toBe(false)
    expect('height' in result).toBe(false)
  })
})
