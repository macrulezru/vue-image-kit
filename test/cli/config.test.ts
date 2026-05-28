import { describe, it, expect, vi, afterEach } from 'vitest'
import { applyTemplate, mergeConfig, DEFAULTS, loadConfig } from '../../src/cli/config'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('applyTemplate', () => {
  it('replaces {name}, {width}, {ext}', () => {
    expect(applyTemplate('{name}-{width}.{ext}', 'photo-1', 800, 'jpg')).toBe('photo-1-800.jpg')
  })

  it('handles webp extension', () => {
    expect(applyTemplate('{name}-{width}.{ext}', 'hero', 400, 'webp')).toBe('hero-400.webp')
  })

  it('supports custom template order', () => {
    expect(applyTemplate('{width}/{name}.{ext}', 'img', 1200, 'avif')).toBe('1200/img.avif')
  })

  it('leaves unknown placeholders unchanged', () => {
    expect(applyTemplate('{name}-{hash}.{ext}', 'photo', 800, 'jpg')).toBe('photo-{hash}.jpg')
  })
})

describe('mergeConfig', () => {
  it('uses defaults when no file or CLI config provided', () => {
    const result = mergeConfig(DEFAULTS, {}, {})
    expect(result.input).toBe(DEFAULTS.input)
    expect(result.widths).toEqual(DEFAULTS.widths)
  })

  it('file config overrides defaults', () => {
    const result = mergeConfig(DEFAULTS, { input: './photos' }, {})
    expect(result.input).toBe('./photos')
  })

  it('CLI args override file config', () => {
    const result = mergeConfig(DEFAULTS, { input: './photos' }, { input: './src/images' })
    expect(result.input).toBe('./src/images')
  })

  it('merges quality deeply', () => {
    const result = mergeConfig(DEFAULTS, { quality: { jpg: 90 } }, { quality: { webp: 70 } })
    expect(result.quality.jpg).toBe(90)
    expect(result.quality.webp).toBe(70)
    expect(result.quality.avif).toBe(DEFAULTS.quality.avif)
  })

  it('CLI quality overrides file quality for same key', () => {
    const result = mergeConfig(DEFAULTS, { quality: { jpg: 90 } }, { quality: { jpg: 95 } })
    expect(result.quality.jpg).toBe(95)
  })

  it('boolean flags are merged correctly', () => {
    const result = mergeConfig(DEFAULTS, { lqip: false }, { clean: true })
    expect(result.lqip).toBe(false)
    expect(result.clean).toBe(true)
  })
})

describe('loadConfig', () => {
  let tmpDir: string

  // Create a fresh temp directory for each test
  function makeTmpDir(): string {
    const dir = join(tmpdir(), `vimage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns empty object when no config file exists', async () => {
    tmpDir = makeTmpDir()
    const result = await loadConfig(tmpDir)
    expect(result).toEqual({})
  })

  it('loads a JSON config file', async () => {
    tmpDir = makeTmpDir()
    writeFileSync(
      join(tmpDir, 'vue-image-kit.config.json'),
      JSON.stringify({ input: './photos', widths: [400, 800] }),
    )
    const result = await loadConfig(tmpDir)
    expect(result.input).toBe('./photos')
    expect(result.widths).toEqual([400, 800])
  })

  it('returns empty object on malformed JSON and logs warning', async () => {
    tmpDir = makeTmpDir()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    writeFileSync(join(tmpDir, 'vue-image-kit.config.json'), '{ not valid json }')
    const result = await loadConfig(tmpDir)
    expect(result).toEqual({})
    expect(warnSpy).toHaveBeenCalled()
  })
})
