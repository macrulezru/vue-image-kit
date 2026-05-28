import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useImagePreloader } from '../../src/composables/useImagePreloader'

// Minimal Image mock — resolves or rejects based on the src
class MockImage {
  src: string = ''
  onload: (() => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor() {
    // Defer to next microtask so callers can assign onload/onerror first
    Promise.resolve().then(() => {
      if (this.src.includes('fail')) {
        this.onerror?.(new Event('error'))
      } else {
        this.onload?.()
      }
    })
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', MockImage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useImagePreloader', () => {
  it('starts with zero progress', () => {
    const { loaded, total, progress, isComplete } = useImagePreloader()
    expect(loaded.value).toBe(0)
    expect(total.value).toBe(0)
    expect(progress.value).toBe(0)
    expect(isComplete.value).toBe(false)
  })

  it('resolves when all images load successfully', async () => {
    const { preload, loaded, total, progress, isComplete } = useImagePreloader()

    await preload(['/a.jpg', '/b.jpg', '/c.jpg'])

    expect(total.value).toBe(3)
    expect(loaded.value).toBe(3)
    expect(progress.value).toBe(100)
    expect(isComplete.value).toBe(true)
  })

  it('counts errors as loaded (does not block completion)', async () => {
    const { preload, loaded, total, isComplete, errors } = useImagePreloader()

    await preload(['/a.jpg', '/fail.jpg'])

    expect(loaded.value).toBe(2)
    expect(total.value).toBe(2)
    expect(isComplete.value).toBe(true)
    expect(errors.value).toContain('/fail.jpg')
  })

  it('resolves immediately for empty array', async () => {
    const { preload, total, isComplete } = useImagePreloader()
    await preload([])
    expect(total.value).toBe(0)
    expect(isComplete.value).toBe(false) // no images = not complete
  })

  it('resets state on each preload call', async () => {
    const { preload, errors } = useImagePreloader()

    await preload(['/fail.jpg'])
    expect(errors.value.length).toBe(1)

    await preload(['/ok.jpg'])
    expect(errors.value.length).toBe(0)
  })

  it('progress is between 0 and 100', async () => {
    const { preload, progress } = useImagePreloader()
    await preload(['/a.jpg', '/b.jpg'])
    expect(progress.value).toBeGreaterThanOrEqual(0)
    expect(progress.value).toBeLessThanOrEqual(100)
  })
})
