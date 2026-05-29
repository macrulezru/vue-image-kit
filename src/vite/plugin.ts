/**
 * Vite plugin for vue-image-kit.
 *
 * Two responsibilities:
 *
 * 1. **Batch generation** — on `buildStart` (and on HMR for source images) it runs
 *    the same `generate` pipeline as the CLI: resize to the configured widths,
 *    emit WebP/AVIF, LQIP, BlurHash, and (optionally) an `images.ts` manifest.
 *
 * 2. **Build-time imports** — query-suffixed imports that return metadata straight
 *    into JS, so you never wire props by hand:
 *
 *      import meta from './photo.jpg?vik'
 *      // → { src, srcset, webp, avif, width, height, placeholder, blurhash, thumbhash, name }
 *
 *      import hash from './photo.jpg?thumbhash'
 *      // → 'base64string'
 *
 *    `?vik` resizes/encodes the image into `output` (URLs use `publicPath`, exactly
 *    like the manifest). `?thumbhash` computes only the hash and writes nothing.
 *
 * Requires `sharp` (and `thumbhash` for hash output) as dev dependencies.
 *
 * Usage in vite.config.ts:
 *   import { vueImageKit } from 'vue-image-kit/vite'
 *   export default defineConfig({
 *     plugins: [vue(), vueImageKit({ widths: [400, 800, 1200] })]
 *   })
 *
 * For typed `?vik` / `?thumbhash` imports add to a `.d.ts` in your project:
 *   /// <reference types="vue-image-kit/vite/client" />
 */
import type { Plugin } from 'vite'
import type { CliConfig, ManifestEntry } from '../cli/types.js'
import { mergeConfig, DEFAULTS, loadConfig } from '../cli/config.js'
import { generate, processImage, computeThumbhash } from '../cli/processor.js'
import { buildEntry } from '../cli/manifest.js'

export type VitePluginOptions = Partial<CliConfig>

/** Metadata returned by a `?vik` import. */
export type VikImageMeta = ManifestEntry

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'])

export type ImageRequestType = 'vik' | 'thumbhash'

export interface ImageRequest {
  /** Absolute or relative path with the query stripped. */
  filePath: string
  /** The raw query string (without the leading `?`). */
  query: string
  type: ImageRequestType
}

/**
 * Parse a module id into a vue-image-kit build-time request, or `null` if it is
 * not one. Recognises `?vik` and `?thumbhash` query flags (alongside any other
 * params). Exported for testing.
 */
export function parseImageRequest(id: string): ImageRequest | null {
  const queryIndex = id.indexOf('?')
  if (queryIndex < 0) return null

  const query = id.slice(queryIndex + 1)
  const params = new URLSearchParams(query)
  const type: ImageRequestType | null = params.has('vik')
    ? 'vik'
    : params.has('thumbhash')
      ? 'thumbhash'
      : null
  if (!type) return null

  return { filePath: id.slice(0, queryIndex), query, type }
}

export function vueImageKit(options: VitePluginOptions = {}): Plugin {
  let resolved: CliConfig | null = null

  async function ensureConfig(): Promise<CliConfig> {
    if (!resolved) {
      const fileConfig = await loadConfig()
      resolved = mergeConfig(DEFAULTS, fileConfig, options)
    }
    return resolved
  }

  return {
    name: 'vue-image-kit',
    enforce: 'pre',

    async buildStart() {
      await generate(await ensureConfig())
    },

    async resolveId(id, importer) {
      const req = parseImageRequest(id)
      if (!req) return null

      const result = await this.resolve(req.filePath, importer, { skipSelf: true })
      if (!result) return null

      // Keep the query so `load` can tell what to produce.
      return `${result.id}?${req.query}`
    },

    async load(id) {
      const req = parseImageRequest(id)
      if (!req) return null

      // Re-run when the source image changes.
      this.addWatchFile(req.filePath)

      if (req.type === 'thumbhash') {
        const hash = await computeThumbhash(req.filePath)
        return `export default ${JSON.stringify(hash)}`
      }

      // ?vik — always include the ThumbHash, the headline of the metadata.
      const config = { ...(await ensureConfig()), thumbhash: true }
      const image = await processImage(req.filePath, config)
      const meta = buildEntry(image, config.widths)
      return `export default ${JSON.stringify(meta)}`
    },

    async handleHotUpdate({ file }) {
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
      if (SUPPORTED_EXTS.has(ext)) {
        await generate(await ensureConfig())
      }
    },
  }
}
