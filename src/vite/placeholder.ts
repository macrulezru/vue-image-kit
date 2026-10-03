import { isAbsolute, join, resolve } from 'node:path'
import { loadSharp, loadThumbhash } from '../cli/deps.js'
import type { RgbaToThumbHash, SharpFactory } from '../cli/deps.js'
import { loadCdnModule } from '../cli/cdn-bridge.js'
import { fileStamp, hasModeData, loadCache, saveCache } from '../cli/placeholders/cache.js'
import type { PlaceholderCache } from '../cli/placeholders/cache.js'
import { resolveTuning, tuningKey } from '../cli/placeholders/compute.js'
import type { PlaceholderData, PlaceholderMode, PlaceholderTuning } from '../cli/placeholders/compute.js'
import { buildFolderManifest, listFolderImages } from '../cli/placeholders/folders.js'
import type { FolderInput } from '../cli/placeholders/folders.js'
import { computeJob, isSvg } from '../cli/placeholders/job.js'
import { entryForMode } from '../cli/placeholders/manifest.js'
import { thumbHashToRGBA } from '../utils/thumbhash-decode.js'
import type { ManifestEntries } from '../cli/placeholders/manifest.js'

export type PlaceholderField = 'blurhash' | 'thumbhash' | 'color' | 'size' | 'preview' | 'aspect'

export const PLACEHOLDER_FIELDS: readonly PlaceholderField[] = [
  'blurhash',
  'thumbhash',
  'color',
  'size',
  'preview',
  'aspect',
]

export const VECTOR_FIELDS: readonly PlaceholderField[] = ['color', 'size', 'aspect']

export interface FieldSpec {
  fields: readonly PlaceholderField[]
  tuning?: PlaceholderTuning | undefined
}

export interface FieldResult {
  blurhash?: string
  thumbhash?: string
  color?: string
  preview?: string
  width?: number
  height?: number
  aspect?: number
}

export interface PlaceholderProps {
  blurhash?: string
  thumbhash?: string
  placeholderColor?: string
  width?: number
  height?: number
}

export interface ImportPlaceholdersOptions {
  extensions?: string[]
  exclude?: string[]
  preview?: boolean | string[]
}

export interface PlaceholdersPluginOptions {
  imports?: boolean | ImportPlaceholdersOptions
  root?: string
  dirs?: FolderInput[]
  urls?: string[]
  mode?: PlaceholderMode
  tuning?: PlaceholderTuning
  publicDir?: string
  concurrency?: number
  timeout?: number
  maxBytes?: number
  refreshRemote?: boolean
}

export interface PlaceholderService {
  mode: PlaceholderMode
  file(filePath: string, mode?: PlaceholderMode): Promise<PlaceholderProps>
  fields(filePath: string, spec: FieldSpec): Promise<FieldResult>
  manifest(): Promise<{ entries: ManifestEntries; files: string[]; warnings: string[]; failures: { key: string; message: string }[] }>
  watchedDirs(): string[]
  flush(): void
}

export function toProps(data: PlaceholderData): PlaceholderProps {
  const props: PlaceholderProps = {}
  if (data.blurhash) props.blurhash = data.blurhash
  if (data.thumbhash) props.thumbhash = data.thumbhash
  if (data.color) props.placeholderColor = data.color
  if (data.width !== undefined) props.width = data.width
  if (data.height !== undefined) props.height = data.height
  return props
}

function hasAll(data: PlaceholderData, needed: ReadonlySet<string>): boolean {
  for (const field of needed) {
    if (field === 'size') {
      if (data.width === undefined || data.height === undefined) return false
    } else if ((data as Record<string, unknown>)[field] === undefined) {
      return false
    }
  }
  return true
}

function pickFields(data: PlaceholderData, wanted: readonly PlaceholderField[]): FieldResult {
  const result: FieldResult = {}
  for (const field of wanted) {
    if (field === 'size' || field === 'aspect') {
      if (data.width === undefined || data.height === undefined) continue
      if (field === 'size') {
        result.width = data.width
        result.height = data.height
      } else {
        result.aspect = Math.round((data.width / data.height) * 10000) / 10000
      }
    } else if (data[field] !== undefined) {
      result[field] = data[field]
    }
  }
  return result
}

export function createPlaceholderService(
  viteRoot: string,
  publicDirSetting: string | false | undefined,
  options: PlaceholdersPluginOptions = {},
): PlaceholderService {
  const root = options.root ? resolve(options.root) : viteRoot
  const mode: PlaceholderMode = options.mode ?? 'blurhash'
  const publicDir = options.publicDir
    ? isAbsolute(options.publicDir)
      ? options.publicDir
      : join(root, options.publicDir)
    : publicDirSetting || join(root, 'public')
  const concurrency = options.concurrency ?? 4
  const timeout = options.timeout ?? 15000
  const maxBytes = options.maxBytes ?? 15 * 1024 * 1024

  const memory = new Map<string, PlaceholderData>()
  let cache: PlaceholderCache | null = null
  let sharp: SharpFactory | null = null
  let rgbaToThumbHash: RgbaToThumbHash | undefined
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function getCache(): PlaceholderCache {
    cache ??= loadCache(root, tuningKey(options.tuning))
    return cache
  }

  function flush(): void {
    if (timer) clearTimeout(timer)
    timer = null
    if (!dirty || !cache) return
    dirty = false
    try {
      saveCache(root, cache)
    } catch {
      return
    }
  }

  function saveSoon(): void {
    dirty = true
    if (timer) return
    timer = setTimeout(flush, 300)
    timer.unref?.()
  }

  async function deps(wanted: PlaceholderMode) {
    sharp ??= await loadSharp('vite plugin')
    if (wanted === 'thumbhash') rgbaToThumbHash ??= await loadThumbhash('vite plugin')
    return { sharp, rgbaToThumbHash, cdn: await loadCdnModule(), cache: getCache() }
  }

  async function renderPreview(thumbhash: string): Promise<string> {
    const decoded = thumbHashToRGBA(new Uint8Array(Buffer.from(thumbhash, 'base64')))
    const loaded = sharp ?? (sharp = await loadSharp('vite plugin'))
    const png = await loaded(Buffer.from(decoded.rgba), {
      raw: { width: decoded.w, height: decoded.h, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  }

  async function computeMissing(
    filePath: string,
    vector: boolean,
    needed: ReadonlySet<string>,
    tuning: PlaceholderTuning | undefined,
    previous: PlaceholderData | undefined,
    jobCache: PlaceholderCache,
  ): Promise<PlaceholderData> {
    const modes: PlaceholderMode[] = []
    if (!vector && needed.has('blurhash')) modes.push('blurhash')
    if (!vector && (needed.has('thumbhash') || needed.has('preview'))) modes.push('thumbhash')
    if (modes.length === 0) modes.push('color')

    let data: PlaceholderData = { ...previous }
    for (const wantedMode of modes) {
      const job = { key: `file:${filePath}`, remote: false, filePath, colorOnly: vector }
      const computed = await computeJob(
        job,
        { mode: wantedMode, tuning, timeout, maxBytes },
        { ...(await deps(wantedMode)), cache: jobCache },
      )
      data = { ...data, ...computed }
    }
    if (!vector && needed.has('preview') && data.thumbhash && data.preview === undefined) {
      data.preview = await renderPreview(data.thumbhash)
    }
    return data
  }

  return {
    mode,

    async file(rawPath, wanted = mode) {
      const filePath = resolve(rawPath)
      const job = { key: `file:${filePath}`, remote: false, filePath, colorOnly: isSvg(filePath) }
      const cached = getCache().entries[job.key]
      const stamp = fileStamp(filePath)
      if (
        cached &&
        cached.mtimeMs === stamp.mtimeMs &&
        cached.size === stamp.size &&
        hasModeData(cached.data, wanted, job.colorOnly)
      ) {
        return toProps(entryForMode(cached.data, wanted))
      }
      const data = await computeJob(
        job,
        { mode: wanted, tuning: options.tuning, timeout, maxBytes },
        await deps(wanted),
      )
      saveSoon()
      return toProps(entryForMode(data, wanted))
    },

    async fields(rawPath, spec) {
      const filePath = resolve(rawPath)
      const vector = isSvg(filePath)
      const needed = new Set<string>()
      for (const field of spec.fields) {
        if (vector && !VECTOR_FIELDS.includes(field)) continue
        needed.add(field === 'aspect' ? 'size' : field)
      }
      if (needed.size === 0) needed.add('size')

      const effective = { ...options.tuning, ...spec.tuning }
      const key = tuningKey(effective)
      const stamp = fileStamp(filePath)

      if (key === tuningKey(options.tuning)) {
        const jobKey = `file:${filePath}`
        const entry = getCache().entries[jobKey]
        const sameFile = entry && entry.mtimeMs === stamp.mtimeMs && entry.size === stamp.size
        if (sameFile && hasAll(entry.data, needed)) return pickFields(entry.data, spec.fields)
        const data = await computeMissing(
          filePath,
          vector,
          needed,
          options.tuning,
          sameFile ? entry.data : undefined,
          getCache(),
        )
        getCache().entries[jobKey] = { ...stamp, data }
        saveSoon()
        return pickFields(data, spec.fields)
      }

      const memoryKey = `${filePath}|${stamp.mtimeMs}|${stamp.size}|${key}`
      const remembered = memory.get(memoryKey)
      if (remembered && hasAll(remembered, needed)) return pickFields(remembered, spec.fields)
      const data = await computeMissing(
        filePath,
        vector,
        needed,
        { ...resolveTuning(effective) },
        remembered,
        { version: 1, tuning: key, entries: {} },
      )
      memory.set(memoryKey, data)
      return pickFields(data, spec.fields)
    },

    async manifest() {
      const result = await buildFolderManifest(
        {
          root,
          publicDir,
          dirs: options.dirs ?? [],
          urls: options.urls ?? [],
          mode,
          tuning: options.tuning,
          concurrency,
          timeout,
          maxBytes,
          refreshRemote: options.refreshRemote ?? false,
        },
        await deps(mode),
      )
      saveSoon()
      return result
    },

    watchedDirs() {
      const warnings: string[] = []
      return (options.dirs ?? []).flatMap((input) =>
        listFolderImages(input, root, publicDir, warnings).map((image) => image.abs),
      )
    },

    flush,
  }
}
