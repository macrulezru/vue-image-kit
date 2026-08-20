import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import sharp from 'sharp'
import { createImageHandler } from '../../src/server/handler'

// Integration test: drives the real sharp pipeline, same as
// test/cli/process-image.test.ts, but through the request-handler surface.

function mockReq(url: string): IncomingMessage {
  return { url } as IncomingMessage
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

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-server-'))
  cacheDir = join(root, '.cache')
  srcPath = join(root, 'photo.jpg')

  await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 30, g: 120, b: 200 } },
  })
    .jpeg()
    .toFile(srcPath)
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

  it('sets a long-lived, immutable Cache-Control header', async () => {
    const handler = createImageHandler({ root, cacheDir, maxAge: 3600 })
    const { res, headers } = mockRes()
    await handler(mockReq('/img?src=/photo.jpg&w=50'), res)
    expect(headers['Cache-Control']).toBe('public, max-age=3600, immutable')
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
})
