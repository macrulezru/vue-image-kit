/**
 * Ambient types for vue-image-kit build-time imports.
 *
 * Reference this once in your project (e.g. in `env.d.ts` or `vite-env.d.ts`):
 *   /// <reference types="vue-image-kit/vite/client" />
 *
 * The `?vik` shape below mirrors `VikImageMeta` (`ManifestEntry`) from
 * `vue-image-kit/vite`; it is inlined here so the declaration resolves with no
 * module lookup regardless of how the package is installed.
 */

declare module '*?vik' {
  const meta: {
    name: string
    src: string
    srcset: string
    webp: string
    avif: string
    width: number
    height: number
    placeholder: string
    blurhash: string
    thumbhash: string
    /** Per-width shortcuts, e.g. `src400`, `src800`. */
    [key: string]: string | number
  }
  export default meta
}

declare module '*?thumbhash' {
  const hash: string
  export default hash
}
