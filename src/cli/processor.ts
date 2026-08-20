import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  writeFileSync,
  copyFileSync,
  statSync,
} from 'node:fs'
import { join, parse, resolve } from 'node:path'
import type { CliConfig, ProcessedImage, ProcessedVariant } from './types.js'
import { applyTemplate } from './config.js'
import { encodeBlurhash } from './blurhash-encode.js'
import { generateManifestContent } from './manifest.js'
import { printImageReport, printBatchSummary } from './report.js'
import {
  computeConfigHash,
  loadIncrementalState,
  saveIncrementalState,
  isUnchanged,
  buildIncrementalEntry,
} from './incremental.js'
import type { IncrementalState } from './incremental.js'

function fileSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return -1
  }
}

// Exported so the Vite plugin (build-time `?vik`/`?thumbhash` imports) can't
// drift out of sync with what the CLI directory scan actually processes.
export const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.gif', '.svg'])

type SharpFactory = Awaited<ReturnType<typeof getSharp>>
type SharpImage = ReturnType<SharpFactory>

// Lazy-load sharp to give a clear error when not installed
async function getSharp() {
  try {
    const sharp = (await import('sharp')).default
    return sharp
  } catch {
    console.error(
      '\n[vue-image-kit] sharp is not installed.\n' +
        'Install it as a dev dependency:\n\n' +
        '  npm install sharp --save-dev\n',
    )
    process.exit(1)
  }
}

// Lazy-load thumbhash with the same clear-error contract as sharp.
async function getRgbaToThumbHash(): Promise<(w: number, h: number, rgba: Uint8Array) => Uint8Array> {
  try {
    return (await import('thumbhash')).rgbaToThumbHash
  } catch {
    console.error(
      '\n[vue-image-kit] thumbhash is not installed.\n' +
        'Install it as a dev dependency:\n\n' +
        '  npm install thumbhash --save-dev\n',
    )
    process.exit(1)
  }
}

// Encode a ThumbHash (base64) from a sharp image — resized to a 100px RGBA thumbnail.
async function thumbhashFromImage(image: SharpImage): Promise<string> {
  const rgbaToThumbHash = await getRgbaToThumbHash()
  const { data, info } = await image
    .clone()
    .resize(100, null, { withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const hash = rgbaToThumbHash(
    info.width,
    info.height,
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  )
  return Buffer.from(hash).toString('base64')
}

function findImages(inputDir: string): string[] {
  const abs = resolve(inputDir)
  if (!existsSync(abs)) {
    throw new Error(`Input directory not found: ${abs}`)
  }

  const results: string[] = []

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (SUPPORTED_EXTS.has(parse(entry.name).ext.toLowerCase())) {
        results.push(full)
      }
    }
  }

  walk(abs)
  return results
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function buildUrl(publicPath: string, filename: string): string {
  const base = publicPath.endsWith('/') ? publicPath.slice(0, -1) : publicPath
  return `${base}/${filename}`
}

function copyThrough(srcPath: string, outPath: string, config: CliConfig): void {
  if (config.dryRun) return
  if (config.skipExisting && existsSync(outPath)) return
  copyFileSync(srcPath, outPath)
}

// SVG is already resolution-independent — copy it through untouched instead
// of rasterizing. `sharp` can still read width/height (via librsvg) for the
// manifest without us re-encoding anything.
async function processSvg(
  srcPath: string,
  name: string,
  outputDir: string,
  config: CliConfig,
  sharp: Awaited<ReturnType<typeof getSharp>>,
): Promise<ProcessedImage> {
  const filename = `${name}.svg`
  const outPath = join(outputDir, filename)
  const url = buildUrl(config.publicPath, filename)
  const skipped = config.skipExisting && existsSync(outPath)
  copyThrough(srcPath, outPath, config)

  let width = 0
  let height = 0
  try {
    const meta = await sharp(srcPath).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  } catch {
    // Some minimal/malformed SVGs aren't readable by librsvg — dimensions
    // just stay 0 rather than failing the whole batch over one icon.
  }

  // Byte-identical copy — the source's own size is always the output size,
  // dry-run or not.
  const sizeBytes = fileSize(srcPath)

  return {
    name,
    srcAbsPath: srcPath,
    originalWidth: width,
    originalHeight: height,
    originalFormat: 'svg',
    originalSizeBytes: sizeBytes,
    variants: [{ absPath: outPath, url, width, height, format: 'svg', sizeBytes, skipped }],
    placeholder: '',
    blurhash: '',
    thumbhash: '',
  }
}

// Animated GIF: copy the original through as the guaranteed-compatible
// fallback, and (when webp is in the requested formats) re-encode to
// animated WebP, which is meaningfully smaller. AVIF is skipped — sharp's
// (libavif) animated-AVIF support is too inconsistent across platforms to
// promise here.
async function buildGifVariants(
  srcPath: string,
  name: string,
  originalWidth: number,
  originalHeight: number,
  outputDir: string,
  config: CliConfig,
  sharp: Awaited<ReturnType<typeof getSharp>>,
): Promise<ProcessedVariant[]> {
  const variants: ProcessedVariant[] = []

  const gifFilename = `${name}.gif`
  const gifOutPath = join(outputDir, gifFilename)
  const gifSkipped = config.skipExisting && existsSync(gifOutPath)
  copyThrough(srcPath, gifOutPath, config)
  // Byte-identical copy — the source's own size is always the output size.
  variants.push({
    absPath: gifOutPath,
    url: buildUrl(config.publicPath, gifFilename),
    width: originalWidth,
    height: originalHeight,
    format: 'gif',
    sizeBytes: fileSize(srcPath),
    skipped: gifSkipped,
  })

  if (config.formats.includes('webp')) {
    const webpFilename = `${name}.webp`
    const webpOutPath = join(outputDir, webpFilename)
    const webpSkipped = config.skipExisting && existsSync(webpOutPath)
    let webpSizeBytes = -1

    if (webpSkipped) {
      webpSizeBytes = fileSize(webpOutPath)
    } else if (!config.dryRun) {
      const quality = config.quality.webp ?? 80
      const info = await sharp(srcPath, { animated: true }).webp({ quality, loop: 0 }).toFile(webpOutPath)
      webpSizeBytes = info.size
    }

    variants.push({
      absPath: webpOutPath,
      url: buildUrl(config.publicPath, webpFilename),
      width: originalWidth,
      height: originalHeight,
      format: 'webp',
      sizeBytes: webpSizeBytes,
      skipped: webpSkipped,
    })
  }

  return variants
}

async function buildRasterVariants(
  image: SharpImage,
  name: string,
  originalWidth: number,
  originalHeight: number,
  outputDir: string,
  config: CliConfig,
): Promise<ProcessedVariant[]> {
  // Skip widths larger than the original; always include the original size.
  const targetWidths = config.widths.filter((w) => w <= originalWidth)
  if (!targetWidths.includes(originalWidth)) {
    targetWidths.push(originalWidth)
  }
  targetWidths.sort((a, b) => a - b)

  const variants: ProcessedVariant[] = []

  for (const width of targetWidths) {
    const isOriginal = width === originalWidth
    // Aspect-ratio estimate — overwritten by sharp's real OutputInfo below
    // whenever we actually encode (skip-existing/dry-run fall back to it).
    const estimatedHeight = originalWidth > 0 ? Math.round((width * originalHeight) / originalWidth) : 0

    for (const format of config.formats) {
      if (format !== 'jpg' && format !== 'webp' && format !== 'avif') continue

      const filename =
        isOriginal && format === 'jpg'
          ? `${name}.jpg`
          : applyTemplate(config.template, name, width, format)

      const outPath = join(outputDir, filename)
      const url = buildUrl(config.publicPath, filename)

      if (config.skipExisting && existsSync(outPath)) {
        variants.push({
          absPath: outPath, url, width, height: estimatedHeight, format,
          sizeBytes: fileSize(outPath), skipped: true,
        })
        continue
      }

      let height = estimatedHeight
      let sizeBytes = -1

      if (!config.dryRun) {
        const resized = image.clone().resize(width, null, { withoutEnlargement: true })
        const quality = config.quality[format] ?? (format === 'jpg' ? 85 : format === 'webp' ? 80 : 65)

        const info = format === 'jpg'
          ? await resized.jpeg({ quality, mozjpeg: true }).toFile(outPath)
          : format === 'webp'
            ? await resized.webp({ quality }).toFile(outPath)
            : await resized.avif({ quality }).toFile(outPath)

        height = info.height
        sizeBytes = info.size
      }

      variants.push({ absPath: outPath, url, width, height, format, sizeBytes, skipped: false })
    }
  }

  return variants
}

async function processOne(
  srcPath: string,
  config: CliConfig,
  sharp: Awaited<ReturnType<typeof getSharp>>,
): Promise<ProcessedImage> {
  const { name, ext } = parse(srcPath)
  const extLower = ext.toLowerCase()
  const outputDir = resolve(config.output)
  ensureDir(outputDir)

  if (extLower === '.svg') {
    return processSvg(srcPath, name, outputDir, config, sharp)
  }

  const image = sharp(srcPath)
  const meta = await image.metadata()
  const originalWidth = meta.width ?? 0
  const originalHeight = meta.height ?? 0
  const originalFormat = extLower.replace(/^\./, '').replace(/^jpeg$/, 'jpg')
  const originalSizeBytes = fileSize(srcPath)

  const variants = extLower === '.gif'
    ? await buildGifVariants(srcPath, name, originalWidth, originalHeight, outputDir, config, sharp)
    : await buildRasterVariants(image, name, originalWidth, originalHeight, outputDir, config)

  // LQIP — tiny 20px JPEG → base64 data URL
  let placeholder = ''
  if (config.lqip && !config.dryRun) {
    const lqipBuf = await image
      .clone()
      .resize(20, null, { withoutEnlargement: true })
      .jpeg({ quality: 20 })
      .toBuffer()
    placeholder = `data:image/jpeg;base64,${lqipBuf.toString('base64')}`
  }

  // BlurHash — compute from a small thumbnail for speed
  let blurhashStr = ''
  if (config.blurhash && !config.dryRun) {
    const thumbSize = 64
    const { data, info } = await image
      .clone()
      .resize(thumbSize, null, { withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    // sharp .raw() by default gives RGB (3 channels) unless image has alpha
    const channels = info.channels
    let rgbBuf: Buffer

    if (channels === 3) {
      rgbBuf = data
    } else {
      // Strip alpha if present (RGBA → RGB)
      rgbBuf = Buffer.alloc(info.width * info.height * 3)
      for (let i = 0; i < info.width * info.height; i++) {
        rgbBuf[i * 3] = data[i * channels]!
        rgbBuf[i * 3 + 1] = data[i * channels + 1]!
        rgbBuf[i * 3 + 2] = data[i * channels + 2]!
      }
    }

    blurhashStr = encodeBlurhash(rgbBuf, info.width, info.height)
  }

  // ThumbHash — RGBA thumbnail (alpha preserved)
  let thumbhashStr = ''
  if (config.thumbhash && !config.dryRun) {
    thumbhashStr = await thumbhashFromImage(image)
  }

  return {
    name, srcAbsPath: srcPath, originalWidth, originalHeight, originalFormat, originalSizeBytes,
    variants, placeholder, blurhash: blurhashStr, thumbhash: thumbhashStr,
  }
}

async function runBatch<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const done = await Promise.all(chunk.map((item) => fn(item)))
    results.push(...done)
  }
  return results
}

export async function generate(config: CliConfig): Promise<void> {
  const sharp = await getSharp()

  if (config.clean && !config.dryRun && existsSync(resolve(config.output))) {
    rmSync(resolve(config.output), { recursive: true, force: true })
    console.log(`[vue-image-kit] Cleaned ${config.output}`)
  }

  const srcFiles = findImages(config.input)

  if (srcFiles.length === 0) {
    console.warn(`[vue-image-kit] No images found in ${config.input}`)
    return
  }

  // Disabled under --dry-run: nothing is actually written, so there's
  // nothing valid to persist and no files to compare against next time.
  let incrementalState: IncrementalState | null = null
  if (config.incremental && !config.dryRun) {
    const configHash = computeConfigHash(config)
    const loaded = loadIncrementalState(config.output)
    if (loaded && loaded.configHash !== configHash) {
      console.log('[vue-image-kit] Config changed since last run — reprocessing everything.')
    }
    incrementalState = loaded && loaded.configHash === configHash ? loaded : { configHash, entries: {} }
  }

  console.log(`[vue-image-kit] Processing ${srcFiles.length} image(s)…`)
  if (config.dryRun) console.log('[vue-image-kit] DRY RUN — no files will be written')

  let skippedCount = 0
  const processed = await runBatch(srcFiles, config.concurrency, async (srcPath) => {
    const absSrc = resolve(srcPath)

    if (incrementalState) {
      const entry = incrementalState.entries[absSrc]
      // Trust the cached entry only if every output file it references is
      // still actually on disk — the incremental state can't tell the
      // difference between "source unchanged" and "source unchanged, but
      // someone deleted a generated file out from under it" on its own.
      if (isUnchanged(entry, absSrc) && entry!.image.variants.every((v) => existsSync(v.absPath))) {
        skippedCount++
        return entry!.image
      }
    }

    const result = await processOne(srcPath, config, sharp)
    printImageReport(result)

    if (incrementalState) {
      incrementalState.entries[absSrc] = buildIncrementalEntry(absSrc, result)
    }

    return result
  })

  if (incrementalState) {
    // Drop entries for sources that no longer exist, so a manifest can't
    // grow forever across renames/deletions.
    const currentPaths = new Set(srcFiles.map((p) => resolve(p)))
    for (const key of Object.keys(incrementalState.entries)) {
      if (!currentPaths.has(key)) delete incrementalState.entries[key]
    }
    saveIncrementalState(config.output, incrementalState)
  }

  if (skippedCount > 0) {
    console.log(`[vue-image-kit] ${skippedCount} image(s) unchanged, skipped.`)
  }

  printBatchSummary(processed)

  if (config.manifest && !config.dryRun) {
    const content = generateManifestContent(processed, config.widths)
    writeFileSync(resolve(config.manifest), content, 'utf8')
    console.log(`[vue-image-kit] Manifest written to ${config.manifest}`)
  } else if (config.manifest && config.dryRun) {
    console.log(`[vue-image-kit] (dry-run) Would write manifest to ${config.manifest}`)
  }
}

/**
 * Process a single source image (resize, formats, placeholders) and return its
 * metadata. Used by the Vite plugin for build-time `?vik` imports — bypasses the
 * directory scan and manifest, writing variants straight into `config.output`.
 */
export async function processImage(srcPath: string, config: CliConfig): Promise<ProcessedImage> {
  const sharp = await getSharp()
  return processOne(srcPath, config, sharp)
}

/**
 * Compute only the ThumbHash (base64) for a single image — no variant files are
 * written. Used by the Vite plugin for `?thumbhash` imports.
 */
export async function computeThumbhash(srcPath: string): Promise<string> {
  const sharp = await getSharp()
  return thumbhashFromImage(sharp(srcPath))
}

export async function watch(config: CliConfig): Promise<void> {
  const { watch: fsWatch } = await import('node:fs')

  console.log(`[vue-image-kit] Watching ${config.input} for changes…`)

  let debounce: NodeJS.Timeout | null = null

  const run = () => {
    generate(config).catch((err) => console.error('[vue-image-kit] Error:', err))
  }

  // Initial run
  run()

  fsWatch(resolve(config.input), { recursive: true }, (_event, filename) => {
    if (!filename) return
    const ext = parse(filename).ext.toLowerCase()
    if (!SUPPORTED_EXTS.has(ext)) return

    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      console.log(`\n[vue-image-kit] Changed: ${filename}`)
      run()
    }, 300)
  })
}
