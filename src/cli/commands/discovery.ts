import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { resolveAliases } from '../scan/aliases.js'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../scan/files.js'
import type { ScanOptions } from '../scan/types.js'
import type { ScanFileConfig } from '../types.js'

export const DEFAULT_PACKAGE_NAME = '@macrulez/vue-image-kit'

export const DISCOVERY_OPTIONS = {
  root: { type: 'string' },
  include: { type: 'string' },
  exclude: { type: 'string' },
  'public-dir': { type: 'string' },
  alias: { type: 'string', multiple: true },
  package: { type: 'string', multiple: true },
  'no-vite-config': { type: 'boolean', default: false },
} as const

export const DISCOVERY_HELP = `  --root <dir>         Project root to scan (default: current directory)
  --include <globs>    Comma-separated globs to scan (default: ${DEFAULT_INCLUDE.join(',')})
  --exclude <globs>    Extra comma-separated globs to skip (node_modules, dist, .nuxt, tests are always skipped)
  --public-dir <dir>   Static assets directory for "/..." paths (default: public)
  --alias <k=path>     Path alias, repeatable, e.g. --alias @=src (tsconfig paths and vite.config aliases are read automatically)
  --package <name>     Extra package name to treat as vue-image-kit, repeatable (e.g. a local alias)
  --no-vite-config     Don't load vite.config to read resolve.alias`

export interface DiscoveryValues {
  root?: string | undefined
  include?: string | undefined
  exclude?: string | undefined
  'public-dir'?: string | undefined
  alias?: string[] | undefined
  package?: string[] | undefined
  'no-vite-config'?: boolean | undefined
}

function splitList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseAliases(values: string[] | undefined): Record<string, string> {
  const aliases: Record<string, string> = {}
  for (const entry of values ?? []) {
    const index = entry.indexOf('=')
    if (index <= 0) throw new Error(`--alias must look like key=path, got "${entry}"`)
    aliases[entry.slice(0, index)] = entry.slice(index + 1)
  }
  return aliases
}

export async function resolveDiscovery(
  values: DiscoveryValues,
  fileConfig: ScanFileConfig = {},
): Promise<ScanOptions> {
  const root = resolve(values.root ?? fileConfig.root ?? process.cwd())
  if (!existsSync(root)) throw new Error(`Root directory not found: ${root}`)

  const publicDirSetting = values['public-dir'] ?? fileConfig.publicDir ?? 'public'
  const publicDir = isAbsolute(publicDirSetting) ? publicDirSetting : join(root, publicDirSetting)
  const explicitAliases = { ...(fileConfig.aliases ?? {}), ...parseAliases(values.alias) }
  const useVite = values['no-vite-config'] ? false : fileConfig.viteConfig !== false

  return {
    root,
    include: splitList(values.include) ?? fileConfig.include ?? DEFAULT_INCLUDE,
    exclude: [
      ...DEFAULT_EXCLUDE,
      ...(fileConfig.exclude ?? []),
      ...(splitList(values.exclude) ?? []),
    ],
    publicDir,
    aliases: await resolveAliases(root, explicitAliases, useVite),
    packageNames: [
      DEFAULT_PACKAGE_NAME,
      ...(fileConfig.packageNames ?? []),
      ...(values.package ?? []),
    ],
  }
}
