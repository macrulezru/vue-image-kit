import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export type AliasMap = Record<string, string>

const NUXT_CONFIGS = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs', 'nuxt.config.mts']

export function findNuxtConfig(root: string): string | null {
  for (const file of NUXT_CONFIGS) {
    const abs = join(root, file)
    if (existsSync(abs)) return abs
  }
  return null
}

export function nuxtSrcDir(root: string): string {
  const appDir = join(root, 'app')
  return existsSync(join(appDir, 'app.vue')) ? appDir : root
}

export function stripJsonComments(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    const next = text[i + 1]
    if (inString) {
      out += char
      if (char === '\\') {
        out += next ?? ''
        i++
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
    } else if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (char === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
    } else {
      out += char
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

interface TsConfigLike {
  extends?: string | string[]
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
}

function readTsConfig(path: string): TsConfigLike | null {
  try {
    return JSON.parse(stripJsonComments(readFileSync(path, 'utf8'))) as TsConfigLike
  } catch {
    return null
  }
}

function pathsToAliases(paths: Record<string, string[]>, baseDir: string): AliasMap {
  const aliases: AliasMap = {}
  for (const [key, targets] of Object.entries(paths)) {
    const target = targets[0]
    if (!target) continue
    const aliasKey = key.replace(/\/\*$/, '')
    if (aliasKey.includes('*')) continue
    aliases[aliasKey] = resolve(baseDir, target.replace(/\/\*$/, ''))
  }
  return aliases
}

function collectTsConfigAliases(configPath: string, depth = 0): AliasMap {
  const config = readTsConfig(configPath)
  if (!config) return {}
  const configDir = dirname(configPath)
  let aliases: AliasMap = {}

  const parents = config.extends
    ? Array.isArray(config.extends)
      ? config.extends
      : [config.extends]
    : []
  if (depth < 3) {
    for (const parent of parents) {
      if (!parent.startsWith('.')) continue
      const parentPath = resolve(configDir, parent.endsWith('.json') ? parent : `${parent}.json`)
      if (existsSync(parentPath))
        aliases = { ...aliases, ...collectTsConfigAliases(parentPath, depth + 1) }
    }
  }

  const options = config.compilerOptions
  if (options?.paths) {
    const baseDir = options.baseUrl ? resolve(configDir, options.baseUrl) : configDir
    aliases = { ...aliases, ...pathsToAliases(options.paths, baseDir) }
  }
  return aliases
}

export function tsconfigAliases(root: string): AliasMap {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const path = join(root, name)
    if (existsSync(path)) return collectTsConfigAliases(path)
  }
  return {}
}

interface ViteAliasEntry {
  find: string | RegExp
  replacement: string
}

export async function viteConfigAliases(root: string): Promise<AliasMap> {
  const names = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.mts',
    'vite.config.cjs',
  ]
  if (!names.some((name) => existsSync(join(root, name)))) return {}
  try {
    const specifier = 'vite'
    const vite = (await import(specifier)) as {
      loadConfigFromFile: (
        env: { command: 'serve'; mode: string },
        configFile: string | undefined,
        configRoot: string,
        logLevel?: string,
      ) => Promise<{ config: { resolve?: { alias?: unknown } } } | null>
    }
    const loaded = await vite.loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      undefined,
      root,
      'silent',
    )
    const alias = loaded?.config.resolve?.alias
    const aliases: AliasMap = {}
    if (Array.isArray(alias)) {
      for (const entry of alias as ViteAliasEntry[]) {
        if (typeof entry.find === 'string' && typeof entry.replacement === 'string') {
          aliases[entry.find.replace(/\/$/, '')] = entry.replacement
        }
      }
    } else if (alias && typeof alias === 'object') {
      for (const [key, value] of Object.entries(alias as Record<string, unknown>)) {
        if (typeof value === 'string') aliases[key.replace(/\/$/, '')] = value
      }
    }
    return aliases
  } catch {
    return {}
  }
}

export function defaultAliases(root: string): AliasMap {
  if (findNuxtConfig(root)) {
    const srcDir = nuxtSrcDir(root)
    return { '~': srcDir, '@': srcDir, '~~': root, '@@': root }
  }
  const src = join(root, 'src')
  return existsSync(src) ? { '@': src } : {}
}

export async function resolveAliases(
  root: string,
  explicit: AliasMap = {},
  useViteConfig = true,
): Promise<AliasMap> {
  const vite = useViteConfig ? await viteConfigAliases(root) : {}
  const merged: AliasMap = { ...defaultAliases(root), ...tsconfigAliases(root), ...vite }
  for (const [key, value] of Object.entries(explicit)) {
    merged[key.replace(/\/$/, '')] = isAbsolute(value) ? value : resolve(root, value)
  }
  return merged
}

export function resolveModulePath(
  specifier: string,
  fromFile: string,
  aliases: AliasMap,
): string | null {
  const clean = specifier.split('?')[0]!
  if (clean.startsWith('./') || clean.startsWith('../')) return resolve(dirname(fromFile), clean)
  const keys = Object.keys(aliases).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (clean === key) return aliases[key]!
    if (clean.startsWith(`${key}/`)) return join(aliases[key]!, clean.slice(key.length + 1))
  }
  return null
}
