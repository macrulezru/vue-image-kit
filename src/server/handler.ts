import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

// Framework-agnostic on-demand image resize handler — for self-hosted setups
// with no CDN and no interest in pre-running the CLI. Mount it under any
// route in plain Node http, Express, Nitro, or (see vite/plugin.ts's
// `dev.onDemand`) a Vite dev server.
//
//   GET {route}?src=/photos/cat.jpg&w=800&format=webp&q=80
//
// Scope: resizes/re-encodes standard raster sources (jpg/png/webp/avif) to
// jpg/webp/avif/png. Anything else (gif/svg, or no width/format at all) is
// streamed through untouched — no sharp involved, no re-encode cost. The
// CLI's batch pipeline (src/cli/processor.ts) is the place for GIF/SVG
// special-casing and multi-variant generation; this handler does one
// transform per request, cached to disk.

const TRANSFORM_FORMATS = ['jpg', 'webp', 'avif', 'png'] as const
type TransformFormat = (typeof TRANSFORM_FORMATS)[number]

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

// Separate from src/cli/processor.ts's getSharp(): that one calls
// process.exit(1) on a missing dependency, which is correct for a one-shot
// CLI command but would take down an entire running server on its first
// request. This throws instead, so the caller can turn it into a 500.
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
  /** Directory source images are resolved against (and confined to). Required. */
  root: string
  /** Directory for cached transformed output. Default: `<root>/.vik-cache`. */
  cacheDir?: string
  /** `Cache-Control: public, max-age=<maxAge>, immutable` on responses. Default: 1 year — the cache key already encodes every transform param, so a hit is safe to treat as permanent. */
  maxAge?: number
  /** Restrict `w` to exactly these values (400 on anything else). Unset: any positive integer, clamped to `maxWidth`. */
  allowedWidths?: number[]
  /** Upper bound for `w` when `allowedWidths` isn't set. Default: 4000. */
  maxWidth?: number
}

export type ImageHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function sendText(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(message)
}

function sendImage(res: ServerResponse, buf: Buffer, mime: string, maxAge: number): void {
  res.statusCode = 200
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`)
  res.end(buf)
}

/**
 * Creates a request handler that resizes/re-encodes an image named by the
 * `src` query parameter, resolved under `options.root`, and caches the
 * result to disk under `options.cacheDir`.
 *
 * @example
 * // Plain Node http
 * const handler = createImageHandler({ root: './public' })
 * createServer((req, res) => {
 *   if (req.url?.startsWith('/_vik/image')) return void handler(req, res)
 *   // ...serve everything else
 * })
 *
 * @example
 * // Express
 * app.get('/_vik/image', createImageHandler({ root: './public' }))
 */
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

      // Resolve strictly under root — reject traversal before touching the
      // filesystem at all, regardless of how the traversal is encoded.
      const absSrc = resolve(root, src.replace(/^\/+/, ''))
      if (absSrc !== root && !absSrc.startsWith(root + sep)) {
        sendText(res, 403, 'Forbidden')
        return
      }
      if (!existsSync(absSrc)) {
        sendText(res, 404, 'Not found')
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

      // Pure passthrough — no transform requested. Stream the original bytes
      // untouched: faster, byte-identical, and works for any file type
      // (including gif/svg) without needing sharp installed at all.
      if (!width && !formatParam) {
        const buf = await readFile(absSrc)
        sendImage(res, buf, mimeFor(extname(absSrc)), maxAge)
        return
      }

      const format = (formatParam as TransformFormat | null) ?? inferFormat(extname(absSrc)) ?? 'jpg'

      const cacheKey = createHash('sha256')
        .update(JSON.stringify({ absSrc, width, format, quality }))
        .digest('hex')
      const cachePath = join(cacheDir, `${cacheKey}.${format}`)

      if (existsSync(cachePath)) {
        sendImage(res, await readFile(cachePath), mimeFor(format), maxAge)
        return
      }

      const sharp = await getSharp()
      let pipeline = sharp(absSrc)
      if (width) pipeline = pipeline.resize(width, null, { withoutEnlargement: true })

      if (format === 'jpg') pipeline = pipeline.jpeg({ quality: quality ?? 85, mozjpeg: true })
      else if (format === 'webp') pipeline = pipeline.webp({ quality: quality ?? 80 })
      else if (format === 'avif') pipeline = pipeline.avif({ quality: quality ?? 65 })
      else pipeline = pipeline.png({ quality: quality ?? 80 })

      const outBuf = await pipeline.toBuffer()

      mkdirSync(cacheDir, { recursive: true })
      await writeFile(cachePath, outBuf)

      sendImage(res, outBuf, mimeFor(format), maxAge)
    } catch (err) {
      sendText(res, 500, err instanceof Error ? err.message : 'Internal error')
    }
  }
}
