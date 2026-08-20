import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, symlinkSync, mkdirSync, utimesSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import sharp from 'sharp'
import { createImageHandler } from '../../src/server/handler'

// Integration test: drives the real sharp pipeline, same as
// test/cli/process-image.test.ts, but through the request-handler surface.

// On Windows, libvips/sharp can keep a native read handle on a source file
// open past the end of a previous request that read it, briefly blocking a
// fresh sharp() write to that same path (see test/cli/process-image.test.ts
// for the same class of issue). Retry instead of failing the test over it.
async function writeJpegWithRetry(
  path: string,
  color: { r: number; g: number; b: number },
  size = { width: 200, height: 100 },
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await sharp({ create: { ...size, channels: 3, background: color } }).jpeg().toFile(path)
      return
    } catch (err) {
      if (attempt >= 30) throw err
      if (global.gc) global.gc()
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}

function mockReq(url: string, headers: Record<string, string> = {}): IncomingMessage {
  return { url, headers } as IncomingMessage
}

function mockRes() {
  const headers: Record<string, string> = {}
  const state = { statusCode: 200, body: undefined as Buffer | string | undefined }
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value
    },
    end(data?: Buffer | string) {
      state.body = data
    },
  }
  Object.defineProperty(res, 'statusCode', {
    get: () => state.statusCode,
    set: (v: number) => {
      state.statusCode = v
    },
  })
  return { res: res as unknown as ServerResponse, headers, state }
}

let root: string
let cacheDir: string
let srcPath: string
let symlinksSupported = false

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-server-'))
  cacheDir = join(root, '.cache')
  srcPath = join(root, 'photo.jpg')

  await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    .jpeg()
    .toFile(srcPath)

  // Symlink creation needs elevated privileges on Windows unless Developer
  // Mode is on — probe once so the symlink-escape test can skip gracefully
  // instead of failing on unrelated environments (CI runs on ubuntu-latest,
  // where this always works).
  try {
    const probeTarget = join(root, '.symlink-probe-target')
    const probeLink = join(root, '.symlink-probe-link')
    writeFileSync(probeTarget, '')
    symlinkSync(probeTarget, probeLink)
    symlinksSupported = true
  } catch {
    symlinksSupported = false
  }
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('createImageHandler', () => {
  it('400s when src is missing', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?w=100'), res)
    expect(state.statusCode).toBe(400)
  })

  it('404s for a nonexistent source', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/nope.jpg'), res)
    expect(state.statusCode).toBe(404)
  })

  it('403s on path traversal', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=' + encodeURIComponent('../../../../etc/passwd')), res)
    expect(state.statusCode).toBe(403)
  })

  it('400s on an invalid width', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=not-a-number'), res)
    expect(state.statusCode).toBe(400)
  })

  it('400s on a width outside allowedWidths', async () => {
    const handler = createImageHandler({ root, cacheDir, allowedWidths: [100, 200] })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=150'), res)
    expect(state.statusCode).toBe(400)
  })

  it('400s on an invalid quality', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=100&q=200'), res)
    expect(state.statusCode).toBe(400)
  })

  it('400s on an unsupported format', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&format=heic'), res)
    expect(state.statusCode).toBe(400)
  })

  it('streams the original bytes untouched when no transform is requested', async () => {
    const handler = createImageHandler({ root, cacheDir })
    const { res, state, headers } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg'), res)

    expect(state.statusCode).toBe(200)
    expect(headers['Content-Type']).toBe('image/jpeg')
    expect(state.body).toEqual(readFileSync(srcPath))
  })

  it('resizes and re-encodes on a cache miss, then serves from cache on the next request', async () => {
    const handler = createImageHandler({ root, cacheDir })

    const first = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=100&format=webp'), first.res)
    expect(first.state.statusCode).toBe(200)
    expect(first.headers['Content-Type']).toBe('image/webp')

    const meta = await sharp(first.state.body as Buffer).metadata()
    expect(meta.width).toBe(100)
    expect(meta.format).toBe('webp')

    const filesAfterFirst = readdirSync(cacheDir)
    expect(filesAfterFirst).toHaveLength(1)

    const second = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=100&format=webp'), second.res)
    expect(second.state.statusCode).toBe(200)
    expect(second.state.body).toEqual(first.state.body)

    // Same cache key — still exactly one cached file, not a second one.
    expect(readdirSync(cacheDir)).toHaveLength(1)
  })

  it('sets a long-lived, revalidating Cache-Control header plus an ETag', async () => {
    const handler = createImageHandler({ root, cacheDir, maxAge: 3600 })
    const { res, headers } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=50'), res)
    expect(headers['Cache-Control']).toBe('public, max-age=3600, must-revalidate')
    expect(headers['ETag']).toBeTruthy()
  })

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const handler = createImageHandler({ root, cacheDir })

    const first = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=60&format=webp'), first.res)
    const etag = first.headers['ETag']
    expect(etag).toBeTruthy()

    const second = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=60&format=webp', { 'if-none-match': etag! }), second.res)
    expect(second.state.statusCode).toBe(304)
    expect(second.state.body).toBeUndefined()
  })

  it('regenerates instead of serving a stale cached transform once the source file changes', async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), 'vik-server-version-'))
    const isolatedCacheDir = join(isolatedRoot, '.cache')
    const isolatedSrc = join(isolatedRoot, 'photo.jpg')

    await writeJpegWithRetry(isolatedSrc, { r: 10, g: 10, b: 10 })

    const handler = createImageHandler({ root: isolatedRoot, cacheDir: isolatedCacheDir })

    const first = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=100&format=webp'), first.res)
    expect(first.state.statusCode).toBe(200)

    // Overwrite the source under the same path/name — same cache-key inputs
    // as before except the source itself, so this only proves the fix if the
    // key actually incorporates the source's own version.
    await writeJpegWithRetry(isolatedSrc, { r: 250, g: 250, b: 250 })
    // Force a deliberately distinct mtime instead of trusting a real-clock
    // sleep to outlast the filesystem's mtime resolution (coarser than 1ms
    // on some filesystems/CI runners) — deterministic regardless of timing.
    const bumped = new Date(statSync(isolatedSrc).mtime.getTime() + 60_000)
    utimesSync(isolatedSrc, bumped, bumped)

    const second = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=100&format=webp'), second.res)
    expect(second.state.statusCode).toBe(200)
    expect(second.state.body).not.toEqual(first.state.body)

    // Two distinct sources → two distinct cache entries, not one overwritten.
    expect(readdirSync(isolatedCacheDir).filter((f) => !f.startsWith('.tmp-'))).toHaveLength(2)

    rmSync(isolatedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('clamps an oversized width to maxWidth instead of rejecting it', async () => {
    const handler = createImageHandler({ root, cacheDir, maxWidth: 100 })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=9000&format=webp'), res)
    expect(state.statusCode).toBe(200)
    const meta = await sharp(state.body as Buffer).metadata()
    expect(meta.width).toBe(100)
  })

  it('defaults cacheDir to <root>/.vik-cache', async () => {
    const isolatedRoot = mkdtempSync(join(tmpdir(), 'vik-server-default-'))
    const isolatedSrc = join(isolatedRoot, 'a.jpg')
    writeFileSync(isolatedSrc, readFileSync(srcPath))

    const handler = createImageHandler({ root: isolatedRoot })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/a.jpg&w=50&format=webp'), res)

    expect(state.statusCode).toBe(200)
    expect(readdirSync(join(isolatedRoot, '.vik-cache'))).toHaveLength(1)

    rmSync(isolatedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('streams a GIF through byte-identical even when w/format are requested — never re-encoded as a static image', async () => {
    const gifDir = mkdtempSync(join(tmpdir(), 'vik-server-gif-'))
    const gifSrc = join(gifDir, 'anim.gif')
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 200, b: 60 } },
    }).gif().toFile(gifSrc)

    const handler = createImageHandler({ root: gifDir })
    const { res, state, headers } = mockRes()
    await handler(mockReq('/img?src=/anim.gif&w=10&format=webp'), res)

    expect(state.statusCode).toBe(200)
    expect(headers['Content-Type']).toBe('image/gif')
    expect(state.body).toEqual(readFileSync(gifSrc))

    rmSync(gifDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it('streams an SVG through byte-identical even when w/format are requested — never rasterized', async () => {
    const svgDir = mkdtempSync(join(tmpdir(), 'vik-server-svg-'))
    const svgSrc = join(svgDir, 'icon.svg')
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>'
    writeFileSync(svgSrc, svgContent, 'utf8')

    const handler = createImageHandler({ root: svgDir })
    const { res, state, headers } = mockRes()
    await handler(mockReq('/img?src=/icon.svg&w=100&format=webp'), res)

    expect(state.statusCode).toBe(200)
    expect(headers['Content-Type']).toBe('image/svg+xml')
    expect((state.body as Buffer).toString('utf8')).toBe(svgContent)

    rmSync(svgDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it.skipIf(!symlinksSupported)('rejects a symlink inside root that points outside it', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'vik-server-outside-'))
    const outsideSecret = join(outsideDir, 'secret.jpg')
    writeFileSync(outsideSecret, readFileSync(srcPath))

    const linkPath = join(root, 'escape-link.jpg')
    symlinkSync(outsideSecret, linkPath)

    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/escape-link.jpg'), res)

    expect(state.statusCode).toBe(403)

    rmSync(linkPath, { force: true })
    rmSync(outsideDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  it.skipIf(!symlinksSupported)('still serves a symlink that resolves inside root', async () => {
    const targetPath = join(root, 'photo.jpg')
    const linkPath = join(root, 'inside-link.jpg')
    symlinkSync(targetPath, linkPath)

    const handler = createImageHandler({ root, cacheDir })
    const { res, state } = mockRes()
    await handler(mockReq('/img?src=/inside-link.jpg'), res)

    expect(state.statusCode).toBe(200)
    expect(state.body).toEqual(readFileSync(srcPath))

    rmSync(linkPath, { force: true })
  })

  it('never leaves a partially-written file at the final cache path under concurrent requests', async () => {
    const concurrentRoot = mkdtempSync(join(tmpdir(), 'vik-server-concurrent-'))
    const concurrentCacheDir = join(concurrentRoot, '.cache')
    const concurrentSrc = join(concurrentRoot, 'photo.jpg')
    mkdirSync(concurrentRoot, { recursive: true })
    writeFileSync(concurrentSrc, readFileSync(srcPath))

    const handler = createImageHandler({ root: concurrentRoot, cacheDir: concurrentCacheDir })

    const requests = Array.from({ length: 5 }, () => mockRes())
    await Promise.all(
      requests.map((r) => handler(mockReq('/img?src=/photo.jpg&w=70&format=webp'), r.res)),
    )

    for (const r of requests) {
      expect(r.state.statusCode).toBe(200)
      const meta = await sharp(r.state.body as Buffer).metadata()
      expect(meta.width).toBe(70)
    }

    // Exactly one real cache file, and no leftover temp files from the race.
    const files = readdirSync(concurrentCacheDir)
    expect(files.filter((f) => !f.startsWith('.tmp-'))).toHaveLength(1)
    expect(files.filter((f) => f.startsWith('.tmp-'))).toHaveLength(0)

    rmSync(concurrentRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })
})
