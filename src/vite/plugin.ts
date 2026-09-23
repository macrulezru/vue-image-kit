import type { Plugin } from 'vite'
import type { CliConfig, ManifestEntry } from '../cli/types.js'
import { mergeConfig, DEFAULTS, loadConfig } from '../cli/config.js'
import { generate, processImage, computeThumbhash, SUPPORTED_EXTS } from '../cli/processor.js'
import { buildEntry } from '../cli/manifest.js'
import { createImageHandler } from '../server/handler.js'
import type { ImageHandlerOptions } from '../server/handler.js'

export interface OnDemandDevOptions extends Pick<ImageHandlerOptions, 'cacheDir' | 'maxAge' | 'allowedWidths' | 'maxWidth'> {
  onDemand?: boolean
  route?: string
}

export type VitePluginOptions = Partial<CliConfig> & { dev?: OnDemandDevOptions }

export type VikImageMeta = ManifestEntry

export type ImageRequestType = 'vik' | 'thumbhash'

export interface ImageRequest {
  filePath: string
  query: string
  type: ImageRequestType
}

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
  let isDev = false

  async function ensureConfig(): Promise<CliConfig> {
    if (!resolved) {
      const fileConfig = await loadConfig()
      resolved = mergeConfig(DEFAULTS, fileConfig, options)

      if (isDev && options.incremental === undefined && fileConfig.incremental === undefined) {
        resolved.incremental = true
      }
    }
    return resolved
  }

  return {
    name: 'vue-image-kit',
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve'
    },

    async buildStart() {
      await generate(await ensureConfig())
    },

    configureServer(server) {
      if (!options.dev?.onDemand) return

      const route = options.dev.route ?? '/_vik/image'
      const handler = createImageHandler({
        root: server.config.root,
        ...(options.dev.cacheDir !== undefined ? { cacheDir: options.dev.cacheDir } : {}),
        ...(options.dev.maxAge !== undefined ? { maxAge: options.dev.maxAge } : {}),
        ...(options.dev.allowedWidths !== undefined ? { allowedWidths: options.dev.allowedWidths } : {}),
        ...(options.dev.maxWidth !== undefined ? { maxWidth: options.dev.maxWidth } : {}),
      })

      server.middlewares.use(route, (req, res, next) => {
        handler(req, res).catch(next)
      })
    },

    async resolveId(id, importer) {
      const req = parseImageRequest(id)
      if (!req) return null

      const result = await this.resolve(req.filePath, importer, { skipSelf: true })
      if (!result) return null

      return `${result.id}?${req.query}`
    },

    async load(id) {
      const req = parseImageRequest(id)
      if (!req) return null

      this.addWatchFile(req.filePath)

      if (req.type === 'thumbhash') {
        const hash = await computeThumbhash(req.filePath)
        return `export default ${JSON.stringify(hash)}`
      }

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
