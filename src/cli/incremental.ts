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

export function isUnchanged(entry: IncrementalEntry | undefined, absSrcPath: string): boolean {
  if (!entry) return false
  if (statSync(absSrcPath).mtimeMs === entry.mtimeMs) return true
  return fileHash(absSrcPath) === entry.hash
}

export function buildIncrementalEntry(absSrcPath: string, image: ProcessedImage): IncrementalEntry {
  return { mtimeMs: statSync(absSrcPath).mtimeMs, hash: fileHash(absSrcPath), image }
}
