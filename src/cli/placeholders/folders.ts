import { existsSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { PlaceholderMode, PlaceholderTuning } from './compute.js'
import { computeJob, isSvg, type JobDeps, type SourceJob } from './job.js'
import { fileStamp, hasModeData } from './cache.js'
import { entryForMode, type ManifestEntries } from './manifest.js'

export interface FolderSpec {
  dir: string
  urlPrefix?: string
}

export type FolderInput = string | FolderSpec

export interface FoldersOptions {
  root: string
  publicDir: string
  dirs: FolderInput[]
  urls: string[]
  mode: PlaceholderMode
  tuning?: PlaceholderTuning | undefined
  concurrency: number
  timeout: number
  maxBytes: number
  refreshRemote: boolean
}

export interface FoldersResult {
  entries: ManifestEntries
  files: string[]
  computed: { local: number; remote: number }
  cached: number
  failures: { key: string; message: string }[]
  warnings: string[]
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.tif', '.gif', '.svg'])

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

function normalizeSpec(input: FolderInput): FolderSpec {
  return typeof input === 'string' ? { dir: input } : input
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (IMAGE_EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) out.push(full)
  }
}

function inside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

export function placeholderDirs(inputs: FolderInput[], root: string): string[] {
  return inputs.map((input) => {
    const { dir } = normalizeSpec(input)
    return isAbsolute(dir) ? dir : resolve(root, dir)
  })
}

export interface FolderImage {
  abs: string
  url: string
}

export function listFolderImages(
  input: FolderInput,
  root: string,
  publicDir: string,
  warnings: string[] = [],
): FolderImage[] {
  const spec = normalizeSpec(input)
  const dir = isAbsolute(spec.dir) ? spec.dir : resolve(root, spec.dir)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    warnings.push(`directory not found: ${spec.dir}`)
    return []
  }
  const files: string[] = []
  walk(dir, files)
  files.sort()

  let warned = false
  return files.map((abs) => {
    if (inside(publicDir, abs)) return { abs, url: `/${toPosix(relative(publicDir, abs))}` }
    if (spec.urlPrefix !== undefined) {
      const prefix = spec.urlPrefix.replace(/\/+$/, '')
      return { abs, url: `${prefix}/${toPosix(relative(dir, abs))}` }
    }
    if (!warned) {
      warned = true
      warnings.push(
        `${spec.dir} is outside the public directory and has no urlPrefix — its images are keyed by their project path (e.g. /${toPosix(relative(root, abs))}), which only matches the dev-server URL`,
      )
    }
    return { abs, url: `/${toPosix(relative(root, abs))}` }
  })
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let index = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (index < items.length) await fn(items[index++]!)
  })
  await Promise.all(workers)
}

export async function buildFolderManifest(
  options: FoldersOptions,
  deps: JobDeps,
): Promise<FoldersResult> {
  const result: FoldersResult = {
    entries: {},
    files: [],
    computed: { local: 0, remote: 0 },
    cached: 0,
    failures: [],
    warnings: [],
  }

  const targets: { url: string; job: SourceJob }[] = []
  for (const input of options.dirs) {
    for (const { abs, url } of listFolderImages(input, options.root, options.publicDir, result.warnings)) {
      result.files.push(abs)
      targets.push({ url, job: { key: `file:${abs}`, remote: false, filePath: abs, colorOnly: isSvg(abs) } })
    }
  }
  for (const raw of options.urls) {
    const url = raw.startsWith('//') ? `https:${raw}` : raw
    const provider = deps.cdn?.detectCdnProvider(url)
    targets.push({
      url: raw,
      job: {
        key: `url:${raw}`,
        remote: true,
        url,
        ...(provider ? { provider } : {}),
        colorOnly: isSvg(url),
      },
    })
  }

  const pending: typeof targets = []
  const data = new Map<string, import('./compute.js').PlaceholderData>()
  for (const target of targets) {
    const { job } = target
    const cached = deps.cache.entries[job.key]
    const usable =
      cached &&
      hasModeData(cached.data, options.mode, job.colorOnly) &&
      (job.remote
        ? !options.refreshRemote
        : (() => {
            const stamp = fileStamp(job.filePath!)
            return cached.mtimeMs === stamp.mtimeMs && cached.size === stamp.size
          })())
    if (usable) {
      data.set(target.url, cached.data)
      result.cached++
    } else {
      pending.push(target)
    }
  }

  await runPool(pending, options.concurrency, async ({ url, job }) => {
    try {
      const computed = await computeJob(
        job,
        {
          mode: options.mode,
          tuning: options.tuning,
          timeout: options.timeout,
          maxBytes: options.maxBytes,
        },
        deps,
      )
      data.set(url, computed)
      if (job.remote) result.computed.remote++
      else result.computed.local++
    } catch (err) {
      result.failures.push({ key: url, message: (err as Error).message })
    }
  })

  for (const { url } of targets) {
    const value = data.get(url)
    if (value) result.entries[url] = entryForMode(value, options.mode)
  }
  return result
}
