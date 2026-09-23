import type { CdnAdapter, CdnUrlOptions } from './types.js'
import { cloudinary } from './cloudinary.js'
import { imgix } from './imgix.js'
import { bunny } from './bunny.js'
import { imagekit } from './imagekit.js'
import { sanity } from './sanity.js'
import { storyblok } from './storyblok.js'
import { contentful } from './contentful.js'
import { gumlet } from './gumlet.js'

interface Detection {
  adapter: CdnAdapter
  assetPath: string
}

type Detector = (url: URL) => Detection | null

function hasQuery(url: URL): boolean {
  return url.search.length > 0
}

function detectCloudinary(url: URL): Detection | null {
  if (url.hostname !== 'res.cloudinary.com' || hasQuery(url)) return null
  const match = url.pathname.match(/^\/([^/]+)\/((?:image|video|raw)\/upload)\/(.+)$/)
  if (!match) return null
  const [, cloudName, resourceType, assetPath] = match
  return { adapter: cloudinary({ cloudName: cloudName!, resourceType: resourceType! }), assetPath: assetPath! }
}

function detectImgix(url: URL): Detection | null {
  if (!url.hostname.endsWith('.imgix.net') || hasQuery(url)) return null
  return { adapter: imgix(`${url.protocol}//${url.hostname}`), assetPath: url.pathname }
}

function detectBunny(url: URL): Detection | null {
  if (!url.hostname.endsWith('.b-cdn.net') || hasQuery(url)) return null
  return { adapter: bunny(`${url.protocol}//${url.hostname}`), assetPath: url.pathname }
}

function detectImageKit(url: URL): Detection | null {
  if (url.hostname !== 'ik.imagekit.io' || hasQuery(url)) return null
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null
  const [id, ...rest] = segments
  return {
    adapter: imagekit(`${url.protocol}//${url.hostname}/${id}`),
    assetPath: `/${rest.join('/')}`,
  }
}

function detectSanity(url: URL): Detection | null {
  if (url.hostname !== 'cdn.sanity.io' || hasQuery(url)) return null
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 4 || segments[0] !== 'images') return null
  const [, projectId, dataset, ...rest] = segments
  return { adapter: sanity({ projectId: projectId!, dataset: dataset! }), assetPath: rest.join('/') }
}

function detectStoryblok(url: URL): Detection | null {
  if (url.hostname !== 'a.storyblok.com') return null
  return { adapter: storyblok(), assetPath: url.toString() }
}

function detectContentful(url: URL): Detection | null {
  if (url.hostname !== 'images.ctfassets.net') return null
  return { adapter: contentful(), assetPath: url.toString() }
}

function detectGumlet(url: URL): Detection | null {
  if (!url.hostname.endsWith('.gumlet.io') || hasQuery(url)) return null
  return { adapter: gumlet(`${url.protocol}//${url.hostname}`), assetPath: url.pathname }
}

const DETECTORS: Detector[] = [
  detectCloudinary,
  detectImgix,
  detectBunny,
  detectImageKit,
  detectSanity,
  detectStoryblok,
  detectContentful,
  detectGumlet,
]

export interface AutoLoaderConfig {
  hosts?: Record<string, CdnAdapter>
}

function resolveDetection(url: string, config: AutoLoaderConfig): Detection | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const customAdapter = config.hosts?.[parsed.hostname]
  if (customAdapter) return { adapter: customAdapter, assetPath: parsed.pathname }

  for (const detect of DETECTORS) {
    const detection = detect(parsed)
    if (detection) return detection
  }

  return null
}

export function autoLoader(url: string, opts: CdnUrlOptions = {}, config: AutoLoaderConfig = {}): string {
  const detection = resolveDetection(url, config)
  return detection ? detection.adapter.url(detection.assetPath, opts) : url
}

export function autoSrcset(
  url: string,
  widths: number[],
  opts: CdnUrlOptions = {},
  config: AutoLoaderConfig = {},
): string | undefined {
  const detection = resolveDetection(url, config)
  return detection ? detection.adapter.srcset(detection.assetPath, widths, opts) : undefined
}
