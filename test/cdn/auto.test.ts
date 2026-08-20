import { describe, it, expect } from 'vitest'
import { autoLoader, autoSrcset, netlify } from '../../src/cdn/index'

describe('autoLoader', () => {
  it('detects Cloudinary from res.cloudinary.com', () => {
    const url = autoLoader('https://res.cloudinary.com/demo/image/upload/photo.jpg', { width: 800 })
    expect(url).toBe('https://res.cloudinary.com/demo/w_800,q_auto,f_auto/image/upload/photo.jpg')
  })

  it('detects imgix from *.imgix.net', () => {
    const url = autoLoader('https://mysite.imgix.net/photo.jpg', { width: 800, format: 'webp' })
    expect(url).toBe('https://mysite.imgix.net/photo.jpg?w=800&fm=webp')
  })

  it('detects Bunny from *.b-cdn.net', () => {
    const url = autoLoader('https://myzone.b-cdn.net/photo.jpg', { width: 800 })
    expect(url).toBe('https://myzone.b-cdn.net/photo.jpg?width=800&quality=80')
  })

  it('detects ImageKit from ik.imagekit.io, preserving the account-id path segment', () => {
    const url = autoLoader('https://ik.imagekit.io/your_id/photo.jpg', { width: 800 })
    expect(url).toBe('https://ik.imagekit.io/your_id/photo.jpg?tr=w-800,f-auto')
  })

  it('detects Sanity from cdn.sanity.io, extracting projectId/dataset', () => {
    const url = autoLoader('https://cdn.sanity.io/images/abc123/production/image-abc-800x600-jpg', { width: 400 })
    expect(url).toBe('https://cdn.sanity.io/images/abc123/production/image-abc-800x600-jpg?w=400&q=80&auto=format')
  })

  it('detects Storyblok from a.storyblok.com', () => {
    const url = autoLoader('https://a.storyblok.com/f/12345/photo.jpg', { width: 800 })
    expect(url).toBe('https://a.storyblok.com/f/12345/800x0/filters:format(webp)/photo.jpg')
  })

  it('detects Contentful from images.ctfassets.net', () => {
    const url = autoLoader('https://images.ctfassets.net/space/token/photo.jpg', { width: 800 })
    expect(url).toBe('https://images.ctfassets.net/space/token/photo.jpg?w=800&q=80&fm=webp')
  })

  it('detects Gumlet from *.gumlet.io', () => {
    const url = autoLoader('https://demo.gumlet.io/photo.jpg', { width: 800, format: 'webp' })
    expect(url).toBe('https://demo.gumlet.io/photo.jpg?w=800&format=webp')
  })

  it('returns the URL unchanged for an unrecognized host', () => {
    const url = 'https://example.com/photo.jpg'
    expect(autoLoader(url, { width: 800 })).toBe(url)
  })

  it('returns the URL unchanged for a relative path', () => {
    const url = '/local/photo.jpg'
    expect(autoLoader(url, { width: 800 })).toBe(url)
  })

  it('uses a custom-host adapter from config.hosts for own-domain providers', () => {
    const url = autoLoader(
      'https://myapp.netlify.app/photo.jpg',
      { width: 800 },
      { hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) } },
    )
    expect(url).toContain('/.netlify/images?url=%2Fphoto.jpg')
    expect(url).toContain('w=800')
  })

  it('config.hosts takes precedence over hostname-fingerprint detection', () => {
    // Contrived, but proves the precedence order rather than assuming it.
    const url = autoLoader(
      'https://mysite.imgix.net/photo.jpg',
      { width: 800 },
      { hosts: { 'mysite.imgix.net': netlify({ origin: 'https://mysite.imgix.net' }) } },
    )
    expect(url).toContain('/.netlify/images')
  })
})

describe('autoSrcset', () => {
  it('builds a real per-width srcset via the detected adapter', () => {
    const srcset = autoSrcset('https://mysite.imgix.net/photo.jpg', [400, 800, 1200])
    expect(srcset).toBe(
      'https://mysite.imgix.net/photo.jpg?w=400&auto=format 400w, '
      + 'https://mysite.imgix.net/photo.jpg?w=800&auto=format 800w, '
      + 'https://mysite.imgix.net/photo.jpg?w=1200&auto=format 1200w',
    )
  })

  it('returns undefined (not the input) for an unrecognized host', () => {
    expect(autoSrcset('https://example.com/photo.jpg', [400, 800])).toBeUndefined()
  })

  it('respects config.hosts for own-domain providers', () => {
    const srcset = autoSrcset(
      'https://myapp.netlify.app/photo.jpg',
      [400, 800],
      {},
      { hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) } },
    )
    expect(srcset).toContain('400w')
    expect(srcset).toContain('800w')
    expect(srcset).toContain('/.netlify/images')
  })
})
