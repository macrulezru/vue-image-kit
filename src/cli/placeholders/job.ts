import type { HazehashEncode, RgbaToThumbHash, SharpFactory } from '../deps.js'
import type { CdnModule } from '../cdn-bridge.js'
import {
  computePlaceholder,
  probeSize,
  type PlaceholderData,
  type PlaceholderMode,
  type PlaceholderTuning,
} from './compute.js'
import { downloadHead, downloadImage } from './fetch.js'
import { fileStamp, type PlaceholderCache } from './cache.js'

export interface SourceJob {
  key: string
  remote: boolean
  url?: string
  provider?: string
  filePath?: string
  colorOnly: boolean
}

export interface JobSettings {
  mode: PlaceholderMode
  tuning?: PlaceholderTuning | undefined
  timeout: number
  maxBytes: number
}

export interface JobDeps {
  sharp: SharpFactory
  rgbaToThumbHash?: RgbaToThumbHash | undefined
  encodeHazehash?: HazehashEncode | undefined
  cdn: CdnModule | null
  cache: PlaceholderCache
}

export function isSvg(path: string): boolean {
  return /\.svg(?:[?#].*)?$/i.test(path)
}

export async function computeJob(
  job: SourceJob,
  settings: JobSettings,
  deps: JobDeps,
): Promise<PlaceholderData> {
  const computeOptions = {
    mode: settings.mode,
    sharp: deps.sharp,
    ...(deps.rgbaToThumbHash ? { rgbaToThumbHash: deps.rgbaToThumbHash } : {}),
    ...(deps.encodeHazehash ? { encodeHazehash: deps.encodeHazehash } : {}),
    ...(settings.tuning ? { tuning: settings.tuning } : {}),
    colorOnly: job.colorOnly,
  }
  const previous = deps.cache.entries[job.key]

  if (!job.remote) {
    let data = await computePlaceholder(job.filePath!, { ...computeOptions, includeSize: true })
    const stamp = fileStamp(job.filePath!)
    const sameFile = previous?.mtimeMs === stamp.mtimeMs && previous?.size === stamp.size
    data = sameFile ? { ...previous!.data, ...data } : data
    deps.cache.entries[job.key] = { ...stamp, data }
    return data
  }

  let data: PlaceholderData
  if (job.provider && deps.cdn) {
    const rendition = deps.cdn.autoLoader(job.url!, { width: 128 })
    const buffer = await downloadImage(rendition, {
      timeout: settings.timeout,
      maxBytes: settings.maxBytes,
    })
    data = await computePlaceholder(buffer, { ...computeOptions, includeSize: false })
    const head = await downloadHead(job.url!, settings.timeout).catch(() => null)
    const size = head ? await probeSize(deps.sharp, head) : null
    if (size) Object.assign(data, size)
  } else {
    const buffer = await downloadImage(job.url!, {
      timeout: settings.timeout,
      maxBytes: settings.maxBytes,
    })
    data = await computePlaceholder(buffer, { ...computeOptions, includeSize: true })
  }
  data = { ...previous?.data, ...data }
  deps.cache.entries[job.key] = { data }
  return data
}
