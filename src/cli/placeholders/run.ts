import { readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import type { ImageUsage, ScanResult } from '../scan/types.js'
import { toPosix } from '../scan/files.js'
import type { RgbaToThumbHash, SharpFactory } from '../deps.js'
import type { CdnModule } from '../cdn-bridge.js'
import {
  computePlaceholder,
  probeSize,
  type PlaceholderData,
  type PlaceholderMode,
} from './compute.js'
import { downloadHead, downloadImage } from './fetch.js'
import { fileStamp, hasModeData, type PlaceholderCache } from './cache.js'
import {
  entryForMode,
  readManifest,
  renderManifest,
  writeManifest,
  type ManifestEntries,
  type ProgramParser,
} from './manifest.js'
import {
  applyEdits,
  dirtyFiles,
  placeholderAttributes,
  REPLACEABLE_PROPS,
  type InsertEdit,
} from './codemod.js'

export interface PlaceholdersOptions {
  root: string
  mode: PlaceholderMode
  manifest: string
  typeImport: string
  remote: boolean
  hosts: string[]
  limit: number
  concurrency: number
  timeout: number
  maxBytes: number
  dryRun: boolean
  write: boolean
  forceWrite: boolean
  refreshRemote: boolean
  replace: boolean
}

export interface PlaceholdersDeps {
  sharp: SharpFactory
  rgbaToThumbHash?: RgbaToThumbHash
  cdn: CdnModule | null
  cache: PlaceholderCache
  parseProgram?: ProgramParser
}

export type SkipReason =
  | 'has-placeholder'
  | 'dynamic-placeholder'
  | 'dynamic'
  | 'not-supported'
  | 'missing-file'
  | 'remote-disabled'
  | 'host-not-allowed'
  | 'limit'
  | 'not-editable'
  | 'failed'
  | 'write-disabled'
  | 'dirty'

export interface PlaceholdersReport {
  mode: PlaceholderMode
  computed: { local: number; remote: number }
  cached: number
  failures: { key: string; message: string }[]
  manifestPath: string | null
  manifestUsages: number
  manifestChanged: boolean
  codemodUsages: number
  codemodFiles: string[]
  codemodPreview: { file: string; line: number; attributes: string[]; removed: string[] }[]
  replaced: number
  skipped: Partial<Record<SkipReason, number>>
  dirty: string[]
  registrationFound: boolean
  fellBackToCodemod: number
}

type Strategy = 'manifest' | 'codemod'

interface Planned {
  usage: ImageUsage
  key: string
  strategy: Strategy
  remove: string[]
}

interface SourceJob {
  key: string
  remote: boolean
  url?: string
  provider?: string
  filePath?: string
  colorOnly: boolean
}

const MANIFEST_KINDS = new Set(['public', 'server', 'cdn', 'remote'])
const REMOTE_KINDS = new Set(['cdn', 'remote'])

function isSvg(path: string): boolean {
  return /\.svg(?:[?#].*)?$/i.test(path)
}

function hostAllowed(url: string, hosts: string[]): boolean {
  if (hosts.length === 0) return true
  try {
    const hostname = new URL(url.startsWith('//') ? `https:${url}` : url).hostname
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (index < items.length) {
        const item = items[index++]!
        await fn(item)
      }
    },
  )
  await Promise.all(workers)
}

function sourceKey(usage: ImageUsage): string {
  if (REMOTE_KINDS.has(usage.source.kind)) return `url:${usage.source.value}`
  return `file:${usage.source.filePath}`
}

function addSkip(report: PlaceholdersReport, reason: SkipReason, count = 1): void {
  report.skipped[reason] = (report.skipped[reason] ?? 0) + count
}

function needsSize(usage: ImageUsage): boolean {
  const layout = usage.props['layout']
  if (layout?.kind === 'static' && layout.value === 'fill') return false
  return !('width' in usage.props) && !('height' in usage.props)
}

export async function runPlaceholders(
  scan: ScanResult,
  options: PlaceholdersOptions,
  deps: PlaceholdersDeps,
): Promise<PlaceholdersReport> {
  const report: PlaceholdersReport = {
    mode: options.mode,
    computed: { local: 0, remote: 0 },
    cached: 0,
    failures: [],
    manifestPath: null,
    manifestUsages: 0,
    manifestChanged: false,
    codemodUsages: 0,
    codemodFiles: [],
    codemodPreview: [],
    skipped: {},
    dirty: [],
    registrationFound: scan.registration.found,
    fellBackToCodemod: 0,
    replaced: 0,
  }

  const planned: Planned[] = []
  for (const usage of scan.usages) {
    if (usage.kind !== 'component') continue
    let remove: string[] = []
    if (usage.hasPlaceholder) {
      if (!options.replace || 'image' in usage.props) {
        addSkip(report, 'has-placeholder')
        continue
      }
      remove = REPLACEABLE_PROPS.filter((name) => name in usage.props)
      const bound = usage.edit?.attributes.some(
        (attribute) =>
          remove.includes(attribute.name) &&
          (attribute.raw.startsWith(':') || attribute.raw.startsWith('v-bind')),
      )
      if (bound || remove.some((name) => usage.props[name]!.kind === 'dynamic')) {
        addSkip(report, 'dynamic-placeholder')
        continue
      }
    }
    const { kind } = usage.source
    if (kind === 'dynamic' || kind === 'vik' || 'v-bind' in usage.props || '...' in usage.props) {
      addSkip(report, 'dynamic')
      continue
    }
    if (kind !== 'local-import' && !MANIFEST_KINDS.has(kind)) {
      addSkip(report, 'not-supported')
      continue
    }
    if (usage.source.fileExists === false) {
      addSkip(report, 'missing-file')
      continue
    }
    const manifestCapable = MANIFEST_KINDS.has(kind) && scan.registration.found
    if ((!manifestCapable || remove.length > 0) && !usage.edit) {
      addSkip(report, 'not-editable')
      continue
    }
    if (remove.length > 0 && !options.write) {
      addSkip(report, 'write-disabled')
      continue
    }
    planned.push({
      usage,
      key: sourceKey(usage),
      strategy: manifestCapable ? 'manifest' : 'codemod',
      remove,
    })
  }

  const jobs = new Map<string, SourceJob>()
  for (const { usage, key } of planned) {
    if (jobs.has(key)) continue
    const remote = REMOTE_KINDS.has(usage.source.kind)
    const location = remote ? usage.source.value! : usage.source.filePath!
    jobs.set(key, {
      key,
      remote,
      ...(remote
        ? {
            url: usage.source.value!.startsWith('//')
              ? `https:${usage.source.value}`
              : usage.source.value!,
          }
        : { filePath: location }),
      ...(usage.source.provider ? { provider: usage.source.provider } : {}),
      colorOnly: isSvg(location),
    })
  }

  const previousManifest = readManifest(options.manifest, deps.parseProgram)
  const results = new Map<string, PlaceholderData>()
  const blocked = new Map<string, SkipReason>()
  let remoteBudget = options.limit > 0 ? options.limit : Infinity

  const toCompute: SourceJob[] = []
  for (const job of jobs.values()) {
    const cached = deps.cache.entries[job.key]
    if (job.remote) {
      if (
        cached &&
        !options.refreshRemote &&
        hasModeData(cached.data, options.mode, job.colorOnly)
      ) {
        results.set(job.key, cached.data)
        report.cached++
        continue
      }
      if (!options.remote) {
        blocked.set(job.key, 'remote-disabled')
        continue
      }
      if (!hostAllowed(job.url!, options.hosts)) {
        blocked.set(job.key, 'host-not-allowed')
        continue
      }
      if (remoteBudget <= 0) {
        blocked.set(job.key, 'limit')
        continue
      }
      remoteBudget--
    } else {
      const stamp = fileStamp(job.filePath!)
      if (
        cached &&
        cached.mtimeMs === stamp.mtimeMs &&
        cached.size === stamp.size &&
        hasModeData(cached.data, options.mode, job.colorOnly)
      ) {
        results.set(job.key, cached.data)
        report.cached++
        continue
      }
    }
    toCompute.push(job)
  }

  await runPool(toCompute, options.concurrency, async (job) => {
    const computeOptions = {
      mode: options.mode,
      sharp: deps.sharp,
      ...(deps.rgbaToThumbHash ? { rgbaToThumbHash: deps.rgbaToThumbHash } : {}),
      colorOnly: job.colorOnly,
    }
    try {
      let data: PlaceholderData
      if (!job.remote) {
        data = await computePlaceholder(job.filePath!, { ...computeOptions, includeSize: true })
        const stamp = fileStamp(job.filePath!)
        const previous = deps.cache.entries[job.key]
        const sameFile = previous?.mtimeMs === stamp.mtimeMs && previous?.size === stamp.size
        data = sameFile ? { ...previous!.data, ...data } : data
        deps.cache.entries[job.key] = { ...stamp, data }
        report.computed.local++
      } else if (job.provider && deps.cdn) {
        const rendition = deps.cdn.autoLoader(job.url!, { width: 128 })
        const buffer = await downloadImage(rendition, {
          timeout: options.timeout,
          maxBytes: options.maxBytes,
        })
        data = await computePlaceholder(buffer, { ...computeOptions, includeSize: false })
        const head = await downloadHead(job.url!, options.timeout).catch(() => null)
        const size = head ? await probeSize(deps.sharp, head) : null
        if (size) Object.assign(data, size)
        data = { ...deps.cache.entries[job.key]?.data, ...data }
        deps.cache.entries[job.key] = { data }
        report.computed.remote++
      } else {
        const buffer = await downloadImage(job.url!, {
          timeout: options.timeout,
          maxBytes: options.maxBytes,
        })
        data = await computePlaceholder(buffer, { ...computeOptions, includeSize: true })
        data = { ...deps.cache.entries[job.key]?.data, ...data }
        deps.cache.entries[job.key] = { data }
        report.computed.remote++
      }
      results.set(job.key, data)
    } catch (err) {
      blocked.set(job.key, 'failed')
      report.failures.push({
        key: job.key.replace(/^(file|url):/, ''),
        message: (err as Error).message,
      })
    }
  })

  const manifestEntries: ManifestEntries = {}
  const editsByFile = new Map<
    string,
    { absFile: string; edits: InsertEdit[]; usages: ImageUsage[] }
  >()

  const addEdit = (usage: ImageUsage, attributes: string[], remove: string[]) => {
    const group = editsByFile.get(usage.file) ?? { absFile: usage.absFile, edits: [], usages: [] }
    group.edits.push({ target: usage.edit!, attributes, remove })
    group.usages.push(usage)
    editsByFile.set(usage.file, group)
    const removed = usage
      .edit!.attributes.filter((attribute) => remove.includes(attribute.name))
      .map((attribute) => attribute.raw)
    report.codemodPreview.push({ file: usage.file, line: usage.line, attributes, removed })
    if (remove.length > 0) report.replaced++
  }

  for (const { usage, key, strategy, remove } of planned) {
    const data = results.get(key)
    if (!data) {
      const previous = strategy === 'manifest' ? previousManifest[usage.source.value!] : undefined
      if (previous) {
        manifestEntries[usage.source.value!] = previous
        report.manifestUsages++
        if (remove.length > 0) addEdit(usage, [], remove)
        continue
      }
      addSkip(report, blocked.get(key) ?? 'failed')
      continue
    }
    if (strategy === 'manifest') {
      manifestEntries[usage.source.value!] = entryForMode(data, options.mode)
      report.manifestUsages++
      if (remove.length > 0) addEdit(usage, [], remove)
      continue
    }
    const attributes = placeholderAttributes(data, options.mode, needsSize(usage))
    if (attributes.length === 0) {
      addSkip(report, 'failed')
      continue
    }
    if (MANIFEST_KINDS.has(usage.source.kind)) report.fellBackToCodemod++
    addEdit(usage, attributes, remove)
  }

  if (Object.keys(manifestEntries).length > 0) {
    report.manifestPath = toPosix(relative(options.root, options.manifest))
    if (!options.dryRun) {
      report.manifestChanged = writeManifest(
        options.manifest,
        renderManifest(manifestEntries, options.manifest, options.typeImport),
      )
    }
  }

  const editCount = [...editsByFile.values()].reduce((sum, group) => sum + group.edits.length, 0)
  if (editCount > 0) {
    if (!options.write) {
      addSkip(report, 'write-disabled', editCount)
      report.codemodPreview = []
      report.replaced = 0
    } else if (options.dryRun) {
      report.codemodUsages = editCount
      report.codemodFiles = [...editsByFile.keys()]
    } else {
      const dirty = options.forceWrite ? [] : dirtyFiles(options.root, [...editsByFile.keys()])
      if (dirty && dirty.length > 0) {
        report.dirty = dirty
        addSkip(report, 'dirty', editCount)
        report.codemodPreview = []
        report.replaced = 0
      } else {
        for (const [file, group] of editsByFile) {
          const source = readFileSync(group.absFile, 'utf8')
          writeFileSync(group.absFile, applyEdits(source, group.edits), 'utf8')
          report.codemodFiles.push(file)
        }
        report.codemodUsages = editCount
      }
    }
  }

  return report
}
