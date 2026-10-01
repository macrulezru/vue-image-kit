import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export const DEFAULT_INCLUDE = ['**/*.{vue,js,jsx,ts,tsx,mjs,mts,cjs,cts}']

export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/*.test.*',
  '**/*.spec.*',
]

const ALWAYS_SKIPPED_DIRS = new Set(['node_modules', '.git'])

function escapeRegex(char: string): string {
  return /[.+^$()|[\]\\]/.test(char) ? `\\${char}` : char
}

export function globToRegExp(glob: string): RegExp {
  let source = ''
  let i = 0
  let braceDepth = 0
  while (i < glob.length) {
    const char = glob[i]!
    if (char === '*') {
      if (glob[i + 1] === '*') {
        const atSegmentStart = i === 0 || glob[i - 1] === '/'
        const followedBySlash = glob[i + 2] === '/'
        if (atSegmentStart && followedBySlash) {
          source += '(?:.*/)?'
          i += 3
          continue
        }
        source += '.*'
        i += 2
        continue
      }
      source += '[^/]*'
    } else if (char === '?') {
      source += '[^/]'
    } else if (char === '{') {
      braceDepth++
      source += '(?:'
    } else if (char === '}' && braceDepth > 0) {
      braceDepth--
      source += ')'
    } else if (char === ',' && braceDepth > 0) {
      source += '|'
    } else {
      source += escapeRegex(char)
    }
    i++
  }
  return new RegExp(`^${source}$`)
}

export function createMatcher(include: string[], exclude: string[]): (relPath: string) => boolean {
  const includeRes = include.map(globToRegExp)
  const excludeRes = exclude.map(globToRegExp)
  return (relPath) =>
    includeRes.some((re) => re.test(relPath)) && !excludeRes.some((re) => re.test(relPath))
}

export function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

export function findSourceFiles(root: string, include: string[], exclude: string[]): string[] {
  const matches = createMatcher(include, exclude)
  const excludeDirs = exclude.map(globToRegExp)
  const results: string[] = []

  function walk(dir: string) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = toPosix(relative(root, full))
      if (entry.isDirectory()) {
        if (ALWAYS_SKIPPED_DIRS.has(entry.name)) continue
        if (excludeDirs.some((re) => re.test(`${rel}/`) || re.test(`${rel}/x`))) continue
        walk(full)
      } else if (entry.isFile() && matches(rel)) {
        results.push(full)
      }
    }
  }

  walk(root)
  return results.sort()
}
