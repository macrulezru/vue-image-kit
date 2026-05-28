/**
 * Vite plugin for vue-image-kit.
 *
 * Processes source images at build time using sharp — resizes to specified widths,
 * converts to WebP/AVIF, generates LQIP base64 and BlurHash, writes an images.ts manifest.
 *
 * Requires `sharp` as a dev dependency.
 *
 * Usage in vite.config.ts:
 *   import { vueImageKit } from 'vue-image-kit/vite'
 *   export default defineConfig({
 *     plugins: [vue(), vueImageKit({ input: './src/images', widths: [400, 800, 1200] })]
 *   })
 */
import type { Plugin } from 'vite'
import type { CliConfig } from '../cli/types.js'
import { mergeConfig, DEFAULTS, loadConfig } from '../cli/config.js'
import { generate } from '../cli/processor.js'

export type VitePluginOptions = Partial<CliConfig>

export function vueImageKit(options: VitePluginOptions = {}): Plugin {
  let resolved: CliConfig | null = null

  return {
    name: 'vue-image-kit',
    enforce: 'pre',

    async buildStart() {
      const fileConfig = await loadConfig()
      resolved = mergeConfig(DEFAULTS, fileConfig, options)
      await generate(resolved)
    },

    async handleHotUpdate({ file }) {
      if (!resolved) return
      const { SUPPORTED_EXTS } = await import('../cli/processor.js').then(
        () => ({ SUPPORTED_EXTS: new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif']) }),
      )
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
      if (SUPPORTED_EXTS.has(ext)) {
        await generate(resolved)
      }
    },
  }
}
