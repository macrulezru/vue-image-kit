import { describe, it, expect } from 'vitest'
import { cloudinary, imgix, bunny, sanity, storyblok, contentful, vercel } from '../../src/cdn/index'

// ─── Cloudinary ───────────────────────────────────────────────────────────────

describe('cloudinary', () => {
  const cdn = cloudinary({ cloudName: 'demo' })

  it('generates a basic URL with default transforms', () => {
    const url = cdn.url('photo.jpg')
    expect(url).toBe('https://res.cloudinary.com/demo/q_auto,f_auto/image/upload/photo.jpg')
  })

  it('includes width transform', () => {
    const url = cdn.url('photo.jpg', { width: 800 })
    expect(url).toContain('w_800')
  })

  it('includes quality transform', () => {
    const url = cdn.url('photo.jpg', { quality: 75 })
    expect(url).toContain('q_75')
  })

  it('includes format transform', () => {
    const url = cdn.url('photo.jpg', { format: 'webp' })
    expect(url).toContain('f_webp')
  })

  it('handles leading slash in path', () => {
    const url = cdn.url('/photo.jpg')
    expect(url).not.toContain('//photo.jpg')
    expect(url).toContain('/photo.jpg')
  })

  it('generates srcset for multiple widths', () => {
    const srcset = cdn.srcset('photo.jpg', [400, 800, 1200])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
    expect(srcset).toContain('1200w')
    // split on ", " (comma+space) — Cloudinary URLs contain commas in transforms
    expect(srcset.split(', ').length).toBe(3)
  })

  it('respects custom resourceType', () => {
    const cdnVideo = cloudinary({ cloudName: 'demo', resourceType: 'video/upload' })
    const url = cdnVideo.url('clip.mp4')
    expect(url).toContain('video/upload')
  })

  it('includes dpr transform', () => {
    const url = cdn.url('photo.jpg', { dpr: 2 })
    expect(url).toContain('dpr_2')
  })

  it('does not include dpr=1', () => {
    const url = cdn.url('photo.jpg', { dpr: 1 })
    expect(url).not.toContain('dpr')
  })

  it('maps fit=cover to c_fill', () => {
    const url = cdn.url('photo.jpg', { fit: 'cover' })
    expect(url).toContain('c_fill')
  })
})

// ─── imgix ────────────────────────────────────────────────────────────────────

describe('imgix', () => {
  const cdn = imgix('https://mysite.imgix.net')

  it('appends auto=format by default', () => {
    const url = cdn.url('photo.jpg')
    expect(url).toContain('auto=format')
  })

  it('includes width param', () => {
    const url = cdn.url('photo.jpg', { width: 800 })
    expect(url).toContain('w=800')
  })

  it('includes quality param', () => {
    const url = cdn.url('photo.jpg', { quality: 70 })
    expect(url).toContain('q=70')
  })

  it('uses fm= for explicit format', () => {
    const url = cdn.url('photo.jpg', { format: 'webp' })
    expect(url).toContain('fm=webp')
    expect(url).not.toContain('auto=format')
  })

  it('strips trailing slash from baseUrl', () => {
    const cdn2 = imgix('https://mysite.imgix.net/')
    const url = cdn2.url('photo.jpg')
    expect(url).not.toContain('//photo.jpg')
  })

  it('includes dpr param', () => {
    const url = cdn.url('photo.jpg', { dpr: 2 })
    expect(url).toContain('dpr=2')
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset('photo.jpg', [400, 800])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
  })
})

// ─── Bunny CDN ────────────────────────────────────────────────────────────────

describe('bunny', () => {
  const cdn = bunny('https://myzone.b-cdn.net')

  it('includes width param', () => {
    const url = cdn.url('photo.jpg', { width: 600 })
    expect(url).toContain('width=600')
  })

  it('defaults quality to 80', () => {
    const url = cdn.url('photo.jpg')
    expect(url).toContain('quality=80')
  })

  it('includes explicit format', () => {
    const url = cdn.url('photo.jpg', { format: 'webp' })
    expect(url).toContain('format=webp')
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset('photo.jpg', [400, 800, 1200])
    expect(srcset.split(',').length).toBe(3)
  })
})

// ─── Sanity ───────────────────────────────────────────────────────────────────

describe('sanity', () => {
  const cdn = sanity({ projectId: 'abc123', dataset: 'production' })

  it('builds correct base URL', () => {
    const url = cdn.url('image-abc.jpg')
    expect(url).toContain('cdn.sanity.io/images/abc123/production')
  })

  it('includes width param', () => {
    const url = cdn.url('image-abc.jpg', { width: 400 })
    expect(url).toContain('w=400')
  })

  it('defaults to auto format', () => {
    const url = cdn.url('image-abc.jpg')
    expect(url).toContain('auto=format')
  })

  it('uses fm= for explicit format', () => {
    const url = cdn.url('image-abc.jpg', { format: 'webp' })
    expect(url).toContain('fm=webp')
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset('img.jpg', [400, 800])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
  })
})

// ─── Storyblok ────────────────────────────────────────────────────────────────

describe('storyblok', () => {
  const cdn = storyblok()
  const base = 'https://a.storyblok.com/f/12345/photo.jpg'

  it('inserts size segment', () => {
    const url = cdn.url(base, { width: 800 })
    expect(url).toContain('800x0')
  })

  it('adds webp filter by default', () => {
    const url = cdn.url(base)
    expect(url).toContain('format(webp)')
  })

  it('adds quality filter when specified', () => {
    const url = cdn.url(base, { quality: 75 })
    expect(url).toContain('quality(75)')
  })

  it('uses explicit format when provided', () => {
    const url = cdn.url(base, { format: 'avif' })
    expect(url).toContain('format(avif)')
  })

  it('returns original URL when path is not Storyblok format', () => {
    const url = cdn.url('https://example.com/photo.jpg')
    expect(url).toBe('https://example.com/photo.jpg')
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset(base, [400, 800])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
  })
})

// ─── Contentful ───────────────────────────────────────────────────────────────

describe('contentful', () => {
  const cdn = contentful()
  const base = 'https://images.ctfassets.net/space/token/photo.jpg'

  it('adds width param', () => {
    const url = cdn.url(base, { width: 800 })
    expect(url).toContain('w=800')
  })

  it('defaults to webp format', () => {
    const url = cdn.url(base)
    expect(url).toContain('fm=webp')
  })

  it('uses explicit format', () => {
    const url = cdn.url(base, { format: 'avif' })
    expect(url).toContain('fm=avif')
  })

  it('adds quality param', () => {
    const url = cdn.url(base, { quality: 90 })
    expect(url).toContain('q=90')
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset(base, [400, 800])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
  })
})

// ─── Vercel ───────────────────────────────────────────────────────────────────

describe('vercel', () => {
  const cdn = vercel({ origin: 'https://myapp.vercel.app' })

  it('uses /_vercel/image endpoint', () => {
    const url = cdn.url('/photo.jpg', { width: 800 })
    expect(url).toContain('/_vercel/image')
    expect(url).toContain('url=%2Fphoto.jpg')
    expect(url).toContain('w=800')
  })

  it('defaults quality to 75', () => {
    const url = cdn.url('/photo.jpg')
    expect(url).toContain('q=75')
  })

  it('uses custom quality', () => {
    const url = cdn.url('/photo.jpg', { quality: 90 })
    expect(url).toContain('q=90')
  })

  it('works without origin (relative URL)', () => {
    const cdnRel = vercel()
    const url = cdnRel.url('/photo.jpg', { width: 400 })
    expect(url.startsWith('/_vercel/image')).toBe(true)
  })

  it('generates srcset', () => {
    const srcset = cdn.srcset('/photo.jpg', [400, 800])
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
  })
})
