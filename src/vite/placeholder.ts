import { isAbsolute, join, resolve } from 'node:path'
import { loadSharp, loadThumbhash } from '../cli/deps.js'
import type { RgbaToThumbHash, SharpFactory } from '../cli/deps.js'
import { loadCdnModule } from '../cli/cdn-bridge.js'
import { fileStamp, hasModeData, loadCache, saveCache } from '../cli/placeholders/cache.js'
import type { PlaceholderCache } from '../cli/placeholders/cache.js'
import { tuningKey } from '../cli/placeholders/compute.js'
import type { PlaceholderData, PlaceholderMode, PlaceholderTuning } from '../cli/placeholders/compute.js'
import { buildFolderManifest, listFolderImages } from '../cli/placeholders/folders.js'
import type { FolderInput } from '../cli/placeholders/folders.js'
import { computeJob, isSvg } from '../cli/placeholders/job.js'
import { entryForMode } from '../cli/placeholders/manifest.js'
import type { ManifestEntries } from '../cli/placeholders/manifest.js'

export interface PlaceholderProps {
  blurhash?: string
  thumbhash?: string
  placeholderColor?: string
  width?: number
  height?: number
}

export interface PlaceholdersPluginOptions {
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
