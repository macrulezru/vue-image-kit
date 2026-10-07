import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { PlaceholderData, PlaceholderMode } from './compute.js'

export interface CacheEntry {
  mtimeMs?: number
  size?: number
  data: PlaceholderData
}

export interface PlaceholderCache {
  version: 1
  tuning?: string
  entries: Record<string, CacheEntry>
}

export function cachePath(root: string): string {
  return join(root, 'node_modules', '.cache', 'vue-image-kit', 'placeholders.json')
}

export function loadCache(root: string, tuning = ''): PlaceholderCache {
  const fresh: PlaceholderCache = { version: 1, tuning, entries: {} }
  const path = cachePath(root)
  if (!existsSync(path)) return fresh
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PlaceholderCache
    if (parsed.version !== 1 || !parsed.entries) return fresh
    return (parsed.tuning ?? '') === tuning ? parsed : fresh
  } catch {
    return fresh
  }
}

export function saveCache(root: string, cache: PlaceholderCache): void {
  const path = cachePath(root)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cache), 'utf8')
}

export function fileStamp(absPath: string): { mtimeMs: number; size: number } {
  const stat = statSync(absPath)
  return { mtimeMs: stat.mtimeMs, size: stat.size }
}

export function hasModeData(
  data: PlaceholderData,
  mode: PlaceholderMode,
  colorOnly: boolean,
): boolean {
  if (colorOnly || mode === 'color') return data.color !== undefined
  if (mode === 'hazehash') return data.hazehash !== undefined
  return mode === 'blurhash' ? data.blurhash !== undefined : data.thumbhash !== undefined
}
