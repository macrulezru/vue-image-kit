import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { join, parse, resolve } from 'node:path'
import type { CliConfig, ProcessedImage, ProcessedVariant } from './types.js'
import { applyTemplate } from './config.js'
import { encodeBlurhash } from './blurhash-encode.js'
import { generateManifestContent } from './manifest.js'

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'])

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

async function processOne(
  srcPath: string,
  config: CliConfig,
  sharp: Awaited<ReturnType<typeof getSharp>>,
): Promise<ProcessedImage> {
  const { name } = parse(srcPath)
  const outputDir = resolve(config.output)
  ensureDir(outputDir)

  const image = sharp(srcPath)
  const meta = await image.metadata()
  const originalWidth = meta.width ?? 0
  const originalHeight = meta.height ?? 0

  // Determine actual widths: skip widths larger than the original
  const targetWidths = config.widths.filter((w) => w <= originalWidth)
  // Always include the original size
  if (!targetWidths.includes(originalWidth)) {
    targetWidths.push(originalWidth)
  }
  targetWidths.sort((a, b) => a - b)

  const variants: ProcessedVariant[] = []

  for (const width of targetWidths) {
    const isOriginal = width === originalWidth

    for (const format of config.formats) {
      const filename =
        isOriginal && format === 'jpg'
          ? `${name}.jpg`
          : applyTemplate(config.template, name, width, format === 'jpg' ? 'jpg' : format)

      const outPath = join(outputDir, filename)
      const url = buildUrl(config.publicPath, filename)

      if (config.skipExisting && existsSync(outPath)) {
        variants.push({ absPath: outPath, url, width, format })
        continue
      }

      if (!config.dryRun) {
        const resized = image.clone().resize(width, null, { withoutEnlargement: true })

        if (format === 'jpg' || format === 'webp' || format === 'avif') {
          const quality = config.quality[format] ?? (format === 'jpg' ? 85 : format === 'webp' ? 80 : 65)

          if (format === 'jpg') {
            await resized.jpeg({ quality, mozjpeg: true }).toFile(outPath)
          } else if (format === 'webp') {
            await resized.webp({ quality }).toFile(outPath)
          } else {
            await resized.avif({ quality }).toFile(outPath)
          }
        }
      }

      variants.push({ absPath: outPath, url, width, format })
    }
  }

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
    let rgbaToThumbHash: (w: number, h: number, rgba: Uint8Array) => Uint8Array
    try {
      const mod = await import('thumbhash')
      rgbaToThumbHash = mod.rgbaToThumbHash
    } catch {
      console.error(
        '\n[vue-image-kit] thumbhash is not installed.\n' +
          'Install it as a dev dependency:\n\n' +
          '  npm install thumbhash --save-dev\n',
      )
      process.exit(1)
    }

    const thumbSize = 100
    const { data, info: tInfo } = await image
      .clone()
      .resize(thumbSize, null, { withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const hash = rgbaToThumbHash(tInfo.width, tInfo.height, new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    thumbhashStr = Buffer.from(hash).toString('base64')
  }

  return { name, srcAbsPath: srcPath, originalWidth, originalHeight, variants, placeholder, blurhash: blurhashStr, thumbhash: thumbhashStr }
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

  console.log(`[vue-image-kit] Processing ${srcFiles.length} image(s)…`)
  if (config.dryRun) console.log('[vue-image-kit] DRY RUN — no files will be written')

  let done = 0
  const processed = await runBatch(srcFiles, config.concurrency, async (srcPath) => {
    const result = await processOne(srcPath, config, sharp)
    done++
    process.stdout.write(`\r  ${done}/${srcFiles.length}  ${parse(srcPath).base}`)
    return result
  })

  process.stdout.write('\n')
  console.log(`[vue-image-kit] Done. Generated ${processed.reduce((n, img) => n + img.variants.length, 0)} file(s).`)

  if (config.manifest && !config.dryRun) {
    const content = generateManifestContent(processed, config.widths)
    writeFileSync(resolve(config.manifest), content, 'utf8')
    console.log(`[vue-image-kit] Manifest written to ${config.manifest}`)
  } else if (config.manifest && config.dryRun) {
    console.log(`[vue-image-kit] (dry-run) Would write manifest to ${config.manifest}`)
  }
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
