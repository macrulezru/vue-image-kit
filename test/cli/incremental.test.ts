import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  computeConfigHash,
  loadIncrementalState,
  saveIncrementalState,
  isUnchanged,
  buildIncrementalEntry,
} from '../../src/cli/incremental'
import { DEFAULTS } from '../../src/cli/config'
import type { ProcessedImage } from '../../src/cli/types'

const fakeImage: ProcessedImage = {
  name: 'photo',
  srcAbsPath: '/src/photo.jpg',
  originalWidth: 100,
  originalHeight: 100,
  originalFormat: 'jpg',
  originalSizeBytes: 1000,
  variants: [],
  placeholder: '',
  blurhash: '',
  thumbhash: '',
}

let dir: string
let srcPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vik-incr-'))
  srcPath = join(dir, 'photo.jpg')
  writeFileSync(srcPath, 'original content')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('computeConfigHash', () => {
  it('is stable for the same relevant config', () => {
    expect(computeConfigHash(DEFAULTS)).toBe(computeConfigHash({ ...DEFAULTS }))
  })

  it('changes when widths change', () => {
    const a = computeConfigHash(DEFAULTS)
    const b = computeConfigHash({ ...DEFAULTS, widths: [100, 200] })
    expect(a).not.toBe(b)
  })

  it('changes when quality changes', () => {
    const a = computeConfigHash(DEFAULTS)
    const b = computeConfigHash({ ...DEFAULTS, quality: { ...DEFAULTS.quality, jpg: 50 } })
    expect(a).not.toBe(b)
  })

  it('does not change for fields that do not affect output (concurrency, watch, dryRun...)', () => {
    const a = computeConfigHash(DEFAULTS)
    const b = computeConfigHash({ ...DEFAULTS, concurrency: 99, watch: true, dryRun: true, skipExisting: true, incremental: true })
    expect(a).toBe(b)
  })
})

describe('loadIncrementalState / saveIncrementalState', () => {
  it('returns null when nothing has been saved yet', () => {
    expect(loadIncrementalState(dir)).toBeNull()
  })

  it('round-trips a saved state', () => {
    const state = { configHash: 'abc', entries: { [srcPath]: buildIncrementalEntry(srcPath, fakeImage) } }
    saveIncrementalState(dir, state)
    const loaded = loadIncrementalState(dir)
    expect(loaded).toEqual(state)
  })

  it('returns null for a corrupt manifest instead of throwing', () => {
    writeFileSync(join(dir, '.vik-incremental.json'), 'not json{{{')
    expect(loadIncrementalState(dir)).toBeNull()
  })
})

describe('isUnchanged', () => {
  it('is false when there is no prior entry', () => {
    expect(isUnchanged(undefined, srcPath)).toBe(false)
  })

  it('is true when mtime matches the recorded entry (fast path)', () => {
    const entry = buildIncrementalEntry(srcPath, fakeImage)
    expect(isUnchanged(entry, srcPath)).toBe(true)
  })

  it('is false when the file content actually changed (mtime + hash both differ)', async () => {
    const entry = buildIncrementalEntry(srcPath, fakeImage)
    await new Promise((r) => setTimeout(r, 10))
    writeFileSync(srcPath, 'different content')
    utimesSync(srcPath, new Date(), new Date())
    expect(isUnchanged(entry, srcPath)).toBe(false)
  })

  it('falls back to a content hash and is still true when mtime changed but content did not', () => {
    const entry = buildIncrementalEntry(srcPath, fakeImage)
    // Simulate a git checkout: mtime bumped, content byte-identical.
    const future = new Date(Date.now() + 60_000)
    utimesSync(srcPath, future, future)
    expect(isUnchanged(entry, srcPath)).toBe(true)
  })
})

describe('buildIncrementalEntry', () => {
  it('captures the current mtime, a content hash, and the image metadata', () => {
    const entry = buildIncrementalEntry(srcPath, fakeImage)
    expect(entry.image).toEqual(fakeImage)
    expect(typeof entry.mtimeMs).toBe('number')
    expect(entry.hash).toHaveLength(64) // sha256 hex
  })
})
