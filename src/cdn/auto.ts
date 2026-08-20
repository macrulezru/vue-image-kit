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
  /** The argument to pass as `adapter.url(assetPath, opts)`. */
  assetPath: string
}

type Detector = (url: URL) => Detection | null

// Only providers with a hostname that's a reliable fingerprint on its own —
// Netlify/Vercel/Cloudflare/TwicPics run on *your* domain, not a distinctive
// one, so they can't be guessed this way (see AutoLoaderConfig.hosts).

// These detectors rebuild a fresh URL from `url.pathname` alone via their
// adapter's `.url()` — any existing query string on the source URL (a
// signed/token'd private-asset URL, an existing transform, a cache-buster)
// would be silently discarded, not merged, since none of these adapters know
// how to combine "existing arbitrary query params" with "opts-derived
// params" for their own URL scheme. Bailing out (leaving the URL exactly as
// given) is the safe choice here — same as an unrecognized host.
function hasQuery(url: URL): boolean {
  return url.search.length > 0
}

function detectCloudinary(url: URL): Detection | null {
  if (url.hostname !== 'res.cloudinary.com' || hasQuery(url)) return null
  // /{cloudName}/{image|video|raw}/upload/{assetPath} — the shape of a raw,
  // not-yet-transformed asset URL. A URL with transformations already baked
  // in (extra segments before the resource type) won't match.
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
  // First path segment is the ImageKit account ID — baked into the adapter's
  // base URL, same as constructing it by hand.
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
  // /images/{projectId}/{dataset}/{assetPath}
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 4 || segments[0] !== 'images') return null
  const [, projectId, dataset, ...rest] = segments
  return { adapter: sanity({ projectId: projectId!, dataset: dataset! }), assetPath: rest.join('/') }
}

function detectStoryblok(url: URL): Detection | null {
  if (url.hostname !== 'a.storyblok.com') return null
  // storyblok()'s url() parses the full URL itself.
  return { adapter: storyblok(), assetPath: url.toString() }
}

function detectContentful(url: URL): Detection | null {
  if (url.hostname !== 'images.ctfassets.net') return null
  // contentful()'s url() parses the full URL itself.
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
  /**
   * Hostname → pre-configured adapter, for providers that run on *your*
   * domain (Netlify, Vercel, Cloudflare, TwicPics with a custom domain) and
   * so can't be fingerprinted from the URL alone.
   *
   * @example
   * autoLoader(src, opts, {
   *   hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) },
   * })
   */
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

/**
 * Detects which CDN a URL belongs to from its hostname and rewrites it with
 * the given transform options — no per-image adapter wiring needed. Returns
 * the URL **unchanged** when nothing matches (safe passthrough — a relative
 * URL, a plain `<img>` src, or a host not in `config.hosts`), so it's safe to
 * run over every `src` unconditionally.
 *
 * @example
 * autoLoader('https://res.cloudinary.com/demo/image/upload/photo.jpg', { width: 800 })
 * // → https://res.cloudinary.com/demo/w_800,q_auto,f_auto/image/upload/photo.jpg
 *
 * autoLoader('/local/photo.jpg', { width: 800})
 * // → '/local/photo.jpg' (no recognized CDN host — unchanged)
 */
export function autoLoader(url: string, opts: CdnUrlOptions = {}, config: AutoLoaderConfig = {}): string {
  const detection = resolveDetection(url, config)
  return detection ? detection.adapter.url(detection.assetPath, opts) : url
}

/**
 * Same detection as {@link autoLoader}, but builds a `srcset` string (one
 * distinct URL per width, via the resolved adapter's own `.srcset()`)
 * instead of a single URL. Unlike `autoLoader`, returns `undefined` — not
 * the input unchanged — when no CDN is detected, since there's no sensible
 * "unchanged srcset" to fall back to; callers should fall back to their own
 * width-based srcset generation in that case.
 *
 * @example
 * autoSrcset('https://mysite.imgix.net/photo.jpg', [400, 800, 1200])
 * // → 'https://mysite.imgix.net/photo.jpg?w=400&auto=format 400w, ...'
 */
export function autoSrcset(
  url: string,
  widths: number[],
  opts: CdnUrlOptions = {},
  config: AutoLoaderConfig = {},
): string | undefined {
  const detection = resolveDetection(url, config)
  return detection ? detection.adapter.srcset(detection.assetPath, widths, opts) : undefined
}
