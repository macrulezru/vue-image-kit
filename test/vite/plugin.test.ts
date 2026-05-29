import { describe, it, expect } from 'vitest'
import { parseImageRequest, vueImageKit } from '../../src/vite/plugin'

describe('parseImageRequest', () => {
  it('returns null for ids without a query', () => {
    expect(parseImageRequest('./photo.jpg')).toBeNull()
    expect(parseImageRequest('/abs/photo.png')).toBeNull()
  })

  it('returns null for unrelated queries', () => {
    expect(parseImageRequest('./photo.jpg?url')).toBeNull()
    expect(parseImageRequest('./photo.jpg?width=400')).toBeNull()
  })

  it('detects ?vik and strips the query from the path', () => {
    expect(parseImageRequest('./img/photo.jpg?vik')).toEqual({
      filePath: './img/photo.jpg',
      query: 'vik',
      type: 'vik',
    })
  })

  it('detects ?thumbhash', () => {
    const req = parseImageRequest('/abs/photo.png?thumbhash')
    expect(req).toEqual({ filePath: '/abs/photo.png', query: 'thumbhash', type: 'thumbhash' })
  })

  it('recognises the flag alongside other params', () => {
    const req = parseImageRequest('./photo.jpg?foo=1&vik&bar=2')
    expect(req?.type).toBe('vik')
    expect(req?.filePath).toBe('./photo.jpg')
    expect(req?.query).toBe('foo=1&vik&bar=2')
  })

  it('prefers vik when both flags are present', () => {
    expect(parseImageRequest('./photo.jpg?vik&thumbhash')?.type).toBe('vik')
  })

  it('keeps the query (including the path) intact for absolute Windows-style paths', () => {
    const req = parseImageRequest('C:/proj/photo.jpg?thumbhash')
    expect(req?.filePath).toBe('C:/proj/photo.jpg')
    expect(req?.type).toBe('thumbhash')
  })
})

describe('vueImageKit plugin shape', () => {
  it('exposes the expected hooks', () => {
    const plugin = vueImageKit()
    expect(plugin.name).toBe('vue-image-kit')
    expect(plugin.enforce).toBe('pre')
    expect(typeof plugin.resolveId).toBe('function')
    expect(typeof plugin.load).toBe('function')
    expect(typeof plugin.buildStart).toBe('function')
    expect(typeof plugin.handleHotUpdate).toBe('function')
  })
})
