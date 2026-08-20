import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import type { CliConfig, ProcessedImage } from './types.js'

export interface IncrementalEntry {
  mtimeMs: number
  hash: string
  image: ProcessedImage
}

export interface IncrementalState {
  configHash: string
  entries: Record<string, IncrementalEntry>
}

const MANIFEST_FILENAME = '.vik-incremental.json'

function manifestPath(output: string): string {
  return join(resolve(output), MANIFEST_FILENAME)
}

/**
 * Hashes only the config fields that actually affect what gets written —
 * widths/formats/quality/template/publicPath/lqip/blurhash/thumbhash.
 * Deliberately excludes concurrency/watch/dryRun/skipExisting/clean/
 * incremental itself, none of which change output content, so touching them
 * doesn't force a needless full-batch reprocess.
 */
export function computeConfigHash(config: CliConfig): string {
  const relevant = {
    widths: config.widths,
    formats: config.formats,
    quality: config.quality,
    template: config.template,
    publicPath: config.publicPath,
    lqip: config.lqip,
    blurhash: config.blurhash,
    thumbhash: config.thumbhash,
  }
  return createHash('sha256').update(JSON.stringify(relevant)).digest('hex')
}

/** Reads the persisted state, or `null` if there isn't one (first run) or it's unreadable (corrupt/foreign file — treated as "nothing cached", not an error). */
export function loadIncrementalState(output: string): IncrementalState | null {
  const path = manifestPath(output)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as IncrementalState
  } catch {
    return null
  }
}

export function saveIncrementalState(output: string, state: IncrementalState): void {
  writeFileSync(manifestPath(output), JSON.stringify(state), 'utf8')
}

function fileHash(absPath: string): string {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex')
}

/**
 * Fast path: mtime unchanged since the recorded entry → unchanged, no read.
 * Slow path (mtime differs — e.g. a git checkout touched every file's mtime
 * without changing most of their content): fall back to a content hash, so
 * an unmodified file after a checkout is still recognized as unchanged
 * instead of triggering a needless reprocess.
 */
export function isUnchanged(entry: IncrementalEntry | undefined, absSrcPath: string): boolean {
  if (!entry) return false
  if (statSync(absSrcPath).mtimeMs === entry.mtimeMs) return true
  return fileHash(absSrcPath) === entry.hash
}

export function buildIncrementalEntry(absSrcPath: string, image: ProcessedImage): IncrementalEntry {
  return { mtimeMs: statSync(absSrcPath).mtimeMs, hash: fileHash(absSrcPath), image }
}
