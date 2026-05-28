import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type { CliConfig } from './types.js'

type PartialCliConfig = Partial<Omit<CliConfig, 'quality'> & { quality: Partial<CliConfig['quality']> }>

const CONFIG_FILES = [
  'vue-image-kit.config.js',
  'vue-image-kit.config.mjs',
  'vue-image-kit.config.cjs',
  'vue-image-kit.config.json',
]

export async function loadConfig(cwd = process.cwd()): Promise<PartialCliConfig> {
  for (const file of CONFIG_FILES) {
    const absPath = join(cwd, file)
    if (!existsSync(absPath)) continue

    try {
      if (file.endsWith('.json')) {
        const { readFileSync } = await import('node:fs')
        return JSON.parse(readFileSync(absPath, 'utf8')) as PartialCliConfig
      }
      // Dynamic import for .js/.mjs/.cjs
      const mod = await import(resolve(absPath))
      const config = (mod.default ?? mod) as PartialCliConfig
      return config
    } catch (err) {
      console.warn(`[vue-image-kit] Could not load config from ${file}:`, err)
    }
  }

  return {}
}

export const DEFAULTS: CliConfig = {
  input: './src/images',
  output: './public/images',
  widths: [400, 800, 1200],
  formats: ['jpg', 'webp', 'avif'],
  quality: { jpg: 85, webp: 80, avif: 65 },
  template: '{name}-{width}.{ext}',
  manifest: false,
  publicPath: '/images',
  lqip: true,
  blurhash: true,
  thumbhash: false,
  clean: false,
  dryRun: false,
  concurrency: 4,
  watch: false,
  skipExisting: false,
}

export function mergeConfig(
  defaults: CliConfig,
  fileConfig: PartialCliConfig,
  cliArgs: PartialCliConfig,
): CliConfig {
  return {
    ...defaults,
    ...fileConfig,
    ...cliArgs,
    quality: {
      ...defaults.quality,
      ...(fileConfig.quality ?? {}),
      ...(cliArgs.quality ?? {}),
    },
  }
}

export function applyTemplate(template: string, name: string, width: number, ext: string): string {
  return template
    .replace('{name}', name)
    .replace('{width}', String(width))
    .replace('{ext}', ext)
}
