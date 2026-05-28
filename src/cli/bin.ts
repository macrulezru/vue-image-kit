#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { loadConfig, mergeConfig, DEFAULTS } from './config.js'
import { generate, watch } from './processor.js'
import type { CliConfig, ImageFormat, QualityConfig } from './types.js'

const HELP = `
vue-image-kit generate — resize images and generate srcset variants

Usage:
  npx vue-image-kit generate [options]

Options:
  --input   <dir>      Source directory (default: ./src/images)
  --output  <dir>      Output directory (default: ./public/images)
  --widths  <list>     Comma-separated widths, e.g. 400,800,1200 (default: 400,800,1200)
  --formats <list>     Output formats: jpg,webp,avif (default: jpg,webp,avif)
  --quality <json>     Quality per format: '{"jpg":85,"webp":80,"avif":65}'
  --template <str>     Filename template: {name}-{width}.{ext} (default)
  --manifest <path>    Write TypeScript manifest to this path
  --public-path <str>  URL prefix for manifest paths (default: /images)
  --lqip               Generate base64 LQIP placeholder (default: true)
  --no-lqip            Disable LQIP generation
  --blurhash           Generate BlurHash string (default: true)
  --no-blurhash        Disable BlurHash generation
  --thumbhash          Generate ThumbHash string (default: false)
  --no-thumbhash       Disable ThumbHash generation
  --clean              Remove output dir before generating
  --dry-run            Preview actions without writing files
  --skip-existing      Skip files that already exist
  --concurrency <n>    Parallel workers (default: 4)
  --watch              Watch input dir and regenerate on change
  --help               Show this help

Examples:
  npx vue-image-kit generate --input ./photos --widths 400,800,1200 --manifest ./src/assets/images.ts
  npx vue-image-kit generate --formats jpg,webp --no-blurhash --skip-existing
  npx vue-image-kit generate --watch
`

function parseCliArgs(): Partial<CliConfig> {
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      input:        { type: 'string' },
      output:       { type: 'string' },
      widths:       { type: 'string' },
      formats:      { type: 'string' },
      quality:      { type: 'string' },
      template:     { type: 'string' },
      manifest:     { type: 'string' },
      'public-path': { type: 'string' },
      lqip:         { type: 'boolean', default: true },
      'no-lqip':    { type: 'boolean', default: false },
      blurhash:     { type: 'boolean', default: true },
      'no-blurhash':{ type: 'boolean', default: false },
      thumbhash:    { type: 'boolean', default: false },
      'no-thumbhash': { type: 'boolean', default: false },
      clean:        { type: 'boolean', default: false },
      'dry-run':    { type: 'boolean', default: false },
      'skip-existing': { type: 'boolean', default: false },
      concurrency:  { type: 'string' },
      watch:        { type: 'boolean', default: false },
      help:         { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    console.log(HELP)
    process.exit(0)
  }

  const result: Partial<CliConfig> = {}

  if (values.input)          result.input = values.input
  if (values.output)         result.output = values.output
  if (values.template)       result.template = values.template
  if (values.manifest)       result.manifest = values.manifest
  if (values['public-path']) result.publicPath = values['public-path']
  if (values.clean)          result.clean = true
  if (values['dry-run'])     result.dryRun = true
  if (values['skip-existing']) result.skipExisting = true
  if (values.watch)          result.watch = true

  if (values['no-lqip'])     result.lqip = false
  else if (values.lqip != null) result.lqip = values.lqip

  if (values['no-blurhash']) result.blurhash = false
  else if (values.blurhash != null) result.blurhash = values.blurhash

  if (values['no-thumbhash']) result.thumbhash = false
  else if (values.thumbhash != null) result.thumbhash = values.thumbhash

  if (values.widths) {
    result.widths = values.widths.split(',').map((w) => {
      const n = parseInt(w.trim(), 10)
      if (isNaN(n) || n <= 0) throw new Error(`Invalid width: "${w}"`)
      return n
    })
  }

  if (values.formats) {
    const allowed = new Set<ImageFormat>(['jpg', 'webp', 'avif'])
    result.formats = values.formats.split(',').map((f) => {
      const fmt = f.trim() as ImageFormat
      if (!allowed.has(fmt)) throw new Error(`Unknown format: "${f}" (allowed: jpg, webp, avif)`)
      return fmt
    })
  }

  if (values.quality) {
    try {
      result.quality = JSON.parse(values.quality) as QualityConfig
    } catch {
      throw new Error(`--quality must be valid JSON, e.g. '{"jpg":85,"webp":80}'`)
    }
  }

  if (values.concurrency) {
    const n = parseInt(values.concurrency, 10)
    if (isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer`)
    result.concurrency = n
  }

  return result
}

async function main() {
  const [command] = process.argv.slice(2).filter((a) => !a.startsWith('-'))

  if (!command || command === 'generate') {
    let cliArgs: Partial<CliConfig>
    try {
      cliArgs = parseCliArgs()
    } catch (err) {
      console.error(`[vue-image-kit] ${(err as Error).message}`)
      process.exit(1)
    }

    const fileConfig = await loadConfig()
    const config = mergeConfig(DEFAULTS, fileConfig, cliArgs)

    try {
      if (config.watch) {
        await watch(config)
      } else {
        await generate(config)
      }
    } catch (err) {
      console.error(`[vue-image-kit] Error:`, err)
      process.exit(1)
    }
  } else {
    console.error(`[vue-image-kit] Unknown command: "${command}". Available: generate`)
    process.exit(1)
  }
}

main()
