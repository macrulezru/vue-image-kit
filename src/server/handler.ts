import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile, writeFile, rename, realpath, unlink } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const TRANSFORM_FORMATS = ['jpg', 'webp', 'avif', 'png'] as const
type TransformFormat = (typeof TRANSFORM_FORMATS)[number]

const UNTRANSFORMABLE_EXTS = new Set(['gif', 'svg'])

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

function mimeFor(ext: string): string {
  return MIME[ext.replace(/^\./, '').toLowerCase()] ?? 'application/octet-stream'
}

function inferFormat(ext: string): TransformFormat | undefined {
  const e = ext.replace(/^\./, '').toLowerCase()
  if (e === 'jpg' || e === 'jpeg') return 'jpg'
  return (TRANSFORM_FORMATS as readonly string[]).includes(e) ? (e as TransformFormat) : undefined
}

async function getSharp() {
  try {
    return (await import('sharp')).default
  } catch {
    throw new Error(
      '[vue-image-kit] sharp is not installed. Install it as a dependency: npm install sharp',
    )
  }
}

export interface ImageHandlerOptions {
  root: string
  cacheDir?: string
  maxAge?: number
  allowedWidths?: number[]
  maxWidth?: number
}

export type ImageHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function sendText(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(message)
}

function ifNoneMatch(req: IncomingMessage, etag: string): boolean {
  const header = req.headers?.['if-none-match']
  if (!header) return false
  return header.split(',').some((v) => v.trim() === etag)
}

function sendNotModified(res: ServerResponse, etag: string, maxAge: number): void {
  res.statusCode = 304
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`)
  res.setHeader('ETag', etag)
  res.end()
}

function sendImage(res: ServerResponse, buf: Buffer, mime: string, maxAge: number, etag: string): void {
  res.statusCode = 200
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`)
  res.setHeader('ETag', etag)
  res.end(buf)
}

function sourceEtag(...parts: (string | number)[]): string {
  return `"${createHash('sha256').update(parts.join(':')).digest('hex')}"`
}

export function createImageHandler(options: ImageHandlerOptions): ImageHandler {
  const root = resolve(options.root)
  const cacheDir = resolve(options.cacheDir ?? join(root, '.vik-cache'))
  const maxAge = options.maxAge ?? 31_536_000
  const maxWidth = options.maxWidth ?? 4000

  return async function handleImageRequest(req, res) {
    try {
      const url = new URL(req.url ?? '', 'http://localhost')
      const src = url.searchParams.get('src')
      if (!src) {
        sendText(res, 400, 'Missing "src" query parameter')
        return
      }

      const absSrc = resolve(root, src.replace(/^\/+/, ''))
      if (absSrc !== root && !absSrc.startsWith(root + sep)) {
        sendText(res, 403, 'Forbidden')
        return
      }
      if (!existsSync(absSrc)) {
        sendText(res, 404, 'Not found')
        return
      }

      let realSrc: string
      let realRoot: string
      try {
        ;[realSrc, realRoot] = await Promise.all([realpath(absSrc), realpath(root)])
      } catch {
        sendText(res, 404, 'Not found')
        return
      }
      if (realSrc !== realRoot && !realSrc.startsWith(realRoot + sep)) {
        sendText(res, 403, 'Forbidden')
        return
      }

      const widthParam = url.searchParams.get('w')
      let width: number | undefined
      if (widthParam !== null) {
        width = parseInt(widthParam, 10)
        if (isNaN(width) || width <= 0) {
          sendText(res, 400, 'Invalid "w" query parameter')
          return
        }
        if (options.allowedWidths) {
          if (!options.allowedWidths.includes(width)) {
            sendText(res, 400, `"w" must be one of: ${options.allowedWidths.join(', ')}`)
            return
          }
        } else if (width > maxWidth) {
          width = maxWidth
        }
      }

      const formatParam = url.searchParams.get('format')
      if (formatParam && !(TRANSFORM_FORMATS as readonly string[]).includes(formatParam)) {
        sendText(res, 400, `Unsupported "format": ${formatParam} (allowed: ${TRANSFORM_FORMATS.join(', ')})`)
        return
      }

      const qualityParam = url.searchParams.get('q')
      let quality: number | undefined
      if (qualityParam !== null) {
        quality = parseInt(qualityParam, 10)
        if (isNaN(quality) || quality < 1 || quality > 100) {
          sendText(res, 400, 'Invalid "q" query parameter')
          return
        }
      }

      const srcExt = extname(realSrc).replace(/^\./, '').toLowerCase()

      if ((!width && !formatParam) || UNTRANSFORMABLE_EXTS.has(srcExt)) {
        const srcStat = statSync(realSrc)
        const etag = sourceEtag(realSrc, srcStat.mtimeMs, srcStat.size)
        if (ifNoneMatch(req, etag)) {
          sendNotModified(res, etag, maxAge)
          return
        }
        const buf = await readFile(realSrc)
        sendImage(res, buf, mimeFor(srcExt), maxAge, etag)
        return
      }

      const format = (formatParam as TransformFormat | null) ?? inferFormat(srcExt) ?? 'jpg'

      const srcStat = statSync(realSrc)
      const sourceVersion = `${srcStat.mtimeMs}:${srcStat.size}`
      const cacheKey = createHash('sha256')
        .update(JSON.stringify({ realSrc, sourceVersion, width, format, quality }))
        .digest('hex')
      const cachePath = join(cacheDir, `${cacheKey}.${format}`)
      const etag = `"${cacheKey}"`

      if (ifNoneMatch(req, etag)) {
        sendNotModified(res, etag, maxAge)
        return
      }

      if (existsSync(cachePath)) {
        sendImage(res, await readFile(cachePath), mimeFor(format), maxAge, etag)
        return
      }

      const sharp = await getSharp()
      let pipeline = sharp(realSrc)
      if (width) pipeline = pipeline.resize(width, null, { withoutEnlargement: true })

      if (format === 'jpg') pipeline = pipeline.jpeg({ quality: quality ?? 85, mozjpeg: true })
      else if (format === 'webp') pipeline = pipeline.webp({ quality: quality ?? 80 })
      else if (format === 'avif') pipeline = pipeline.avif({ quality: quality ?? 65 })
      else pipeline = pipeline.png({ quality: quality ?? 80 })

      const outBuf = await pipeline.toBuffer()

      mkdirSync(cacheDir, { recursive: true })
      const tmpPath = join(cacheDir, `.tmp-${cacheKey}-${randomUUID()}`)
      await writeFile(tmpPath, outBuf)
      try {
        await rename(tmpPath, cachePath)
      } catch (renameErr) {
        await unlink(tmpPath).catch(() => {})
        if (!existsSync(cachePath)) throw renameErr
      }

      sendImage(res, outBuf, mimeFor(format), maxAge, etag)
    } catch (err) {
      sendText(res, 500, err instanceof Error ? err.message : 'Internal error')
    }
  }
}
