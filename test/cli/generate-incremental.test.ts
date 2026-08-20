import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { generate } from '../../src/cli/processor'
import { DEFAULTS } from '../../src/cli/config'
import type { CliConfig } from '../../src/cli/types'

// End-to-end: drives the real generate() pipeline (real sharp encodes) across
// multiple runs against the same output dir, the way --watch or the Vite
// plugin's buildStart/handleHotUpdate actually invoke it repeatedly.

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  } catch {
    // best-effort — see test/cli/process-image.test.ts for why
  }
}

// On Windows, libvips/sharp can keep a native read handle on a source file
// open past the end of the previous generate() call, briefly blocking a
// fresh sharp() write to that same path (see test/cli/process-image.test.ts
// for the same class of issue). Retry instead of failing the test over it.
async function writeJpegWithRetry(path: string, color: { r: number; g: number; b: number }): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await sharp({ create: { width: 100, height: 100, channels: 3, background: color } })
        .jpeg()
        .toFile(path)
      return
    } catch (err) {
      if (attempt >= 30) throw err
      if (global.gc) global.gc() // vitest runs with --expose-gc; nudges the stale Sharp wrapper's release sooner
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'vik-incr-gen-'))
  const input = join(dir, 'images')
  const output = join(dir, 'out')
  mkdirSync(input, { recursive: true })

  await writeJpegWithRetry(join(input, 'photo.jpg'), { r: 10, g: 20, b: 30 })
  await new Promise((r) => setTimeout(r, 5)) // ensure a later touch produces a distinct mtime

  const config: CliConfig = {
    ...DEFAULTS,
    input,
    output,
    widths: [50],
    formats: ['jpg'],
    incremental: true,
  }

  return { dir, input, output, config }
}

function captureLog() {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  return {
    spy,
    text: () => spy.mock.calls.map((args) => args.join(' ')).join('\n'),
    restore: () => spy.mockRestore(),
  }
}

describe('generate() — incremental mode', () => {
  it('skips reprocessing an unchanged source on the second run', async () => {
    const { dir, config } = await setup()

    await generate(config)

    const log = captureLog()
    await generate(config)
    expect(log.text()).toContain('1 image(s) unchanged, skipped.')
    expect(log.text()).not.toContain('[vue-image-kit] photo\n')
    log.restore()

    cleanupDir(dir)
  })

  it('still writes a correct manifest/report for a skipped (reused) image', async () => {
    const { dir, config } = await setup()
    const manifestPath = join(dir, 'images.ts')

    await generate({ ...config, manifest: manifestPath })
    await generate({ ...config, manifest: manifestPath })

    expect(existsSync(manifestPath)).toBe(true)
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(manifestPath, 'utf8')).toContain('"photo"')

    cleanupDir(dir)
  })

  it('reprocesses a source once its content actually changes', async () => {
    const { dir, input, config } = await setup()
    await generate(config)

    await writeJpegWithRetry(join(input, 'photo.jpg'), { r: 200, g: 0, b: 0 })

    const log = captureLog()
    await generate(config)
    expect(log.text()).toContain('[vue-image-kit] photo')
    expect(log.text()).not.toContain('unchanged, skipped')
    log.restore()

    cleanupDir(dir)
  })

  it('reprocesses everything when the relevant config changes', async () => {
    const { dir, config } = await setup()
    await generate(config)

    const log = captureLog()
    await generate({ ...config, widths: [80] })
    expect(log.text()).toContain('Config changed since last run')
    expect(log.text()).toContain('[vue-image-kit] photo')
    log.restore()

    cleanupDir(dir)
  })

  it('does nothing incremental under --dry-run (no manifest written, no skip)', async () => {
    const { dir, config } = await setup()
    await generate(config)

    const log = captureLog()
    await generate({ ...config, dryRun: true })
    expect(log.text()).not.toContain('unchanged, skipped')
    log.restore()

    expect(existsSync(join(config.output, '.vik-incremental.json'))).toBe(true)

    cleanupDir(dir)
  })

  it('reprocesses a source when one of its cached output files was deleted from disk', async () => {
    const { dir, output, config } = await setup()
    await generate(config)

    const outputFiles = readdirSync(output).filter((f) => f.endsWith('.jpg'))
    expect(outputFiles.length).toBeGreaterThan(0)
    const deletedFile = join(output, outputFiles[0]!)
    rmSync(deletedFile, { force: true })
    expect(existsSync(deletedFile)).toBe(false)

    const log = captureLog()
    await generate(config)
    // Not trusted as "unchanged" — the .vik-incremental.json entry still
    // matches the source's mtime/hash, but one of the output files it
    // promised no longer exists, so it must be regenerated instead of
    // silently skipped.
    expect(log.text()).toContain('[vue-image-kit] photo')
    expect(log.text()).not.toContain('unchanged, skipped')
    log.restore()

    expect(existsSync(deletedFile)).toBe(true)

    cleanupDir(dir)
  })

  it('is fully reprocessed every run when incremental is off (default)', async () => {
    const { dir, config } = await setup()
    const nonIncremental = { ...config, incremental: false }

    await generate(nonIncremental)

    const log = captureLog()
    await generate(nonIncremental)
    expect(log.text()).toContain('[vue-image-kit] photo')
    expect(log.text()).not.toContain('unchanged, skipped')
    log.restore()

    expect(existsSync(join(config.output, '.vik-incremental.json'))).toBe(false)

    cleanupDir(dir)
  })
})
