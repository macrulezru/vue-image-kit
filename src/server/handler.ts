import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile, writeFile, rename, realpath, unlink } from 'node:fs/promises'
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

// Extensions sharp is never asked to touch here, regardless of `w`/`format`
// — animated GIFs would silently lose their animation (re-encoded as a
// single frame), and SVGs are already resolution-independent. See
// src/cli/processor.ts for the batch pipeline's actual GIF/SVG handling.
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
  /** `Cache-Control: public, max-age=<maxAge>, must-revalidate` on responses, plus a content-derived `ETag`. Default: 1 year. The response URL (`src`/`w`/`format`/`q`) carries no content version, so a source file changing at the same `src` must still be able to invalidate a client's cached copy — `must-revalidate` plus the ETag makes that a cheap conditional (304) request instead of either stale-forever caching or none at all. */
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
  // Not `immutable`: the request URL doesn't encode a content version, so a
  // changed source at the same `src` has to be able to invalidate a
  // previously cached response. `must-revalidate` + a source-derived ETag
  // lets a client's revalidation request come back as a cheap 304 when the
  // source hasn't actually changed, instead of blindly trusting a year-long
  // cache that has no way to know otherwise.
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`)
  res.setHeader('ETag', etag)
  res.end(buf)
}

function sourceEtag(...parts: (string | number)[]): string {
  return `"${createHash('sha256').update(parts.join(':')).digest('hex')}"`
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

      // Defense-in-depth against a symlink living inside `root` that points
      // outside it — the lexical check above only catches traversal encoded
      // in the `src` string itself; a symlink's real target isn't visible
      // until resolved. All file access below uses this resolved path.
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

      // Pure passthrough — no transform requested, or the source is one sharp
      // shouldn't touch here at all (gif/svg — see UNTRANSFORMABLE_EXTS).
      // Stream the original bytes untouched: faster, byte-identical, and
      // works without needing sharp installed at all.
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

      // Source's mtime+size feed the cache key so a changed file at the same
      // path (someone re-uploads a photo under the same name) produces a new
      // key instead of silently serving the old transform forever.
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

      // Write to a unique temp file first, then rename into place — rename
      // within the same directory is atomic, so a concurrent request reading
      // `cachePath` (existsSync + readFile above) can never observe a
      // partially-written file, unlike writing `cachePath` directly.
      mkdirSync(cacheDir, { recursive: true })
      const tmpPath = join(cacheDir, `.tmp-${cacheKey}-${randomUUID()}`)
      await writeFile(tmpPath, outBuf)
      try {
        await rename(tmpPath, cachePath)
      } catch (renameErr) {
        // Two concurrent requests for the same not-yet-cached transform can
        // both reach this point and race to rename onto the same
        // `cachePath` — harmless on POSIX (the loser's rename just silently
        // wins-or-no-ops), but Windows can reject a rename onto a
        // destination another handle already has open with EPERM. If the
        // other request's write actually landed, that's not a real failure
        // — just drop our own now-redundant temp file and serve the (content
        // -identical, same inputs) buffer we already computed.
        await unlink(tmpPath).catch(() => {})
        if (!existsSync(cachePath)) throw renameErr
      }

      sendImage(res, outBuf, mimeFor(format), maxAge, etag)
    } catch (err) {
      sendText(res, 500, err instanceof Error ? err.message : 'Internal error')
    }
  }
}
