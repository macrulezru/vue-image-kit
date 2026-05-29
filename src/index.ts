import type { App } from 'vue'
import VImage from './components/VImage.vue'
import { vLazyImg } from './directives/vLazyImg'
import { BREAKPOINTS_KEY } from './composables/useBreakpoints'
import type { VImageKitOptions } from './types'

export { VImage }
export { vLazyImg }
export { useImage } from './composables/useImage'
export { useBlurhash } from './composables/useBlurhash'
export { useLazyLoad } from './composables/useLazyLoad'
export { useBreakpoints, BREAKPOINTS_KEY } from './composables/useBreakpoints'
export { useImagePreloader } from './composables/useImagePreloader'
export { useBackgroundImage } from './composables/useBackgroundImage'
export type { UseBackgroundImageOptions, UseBackgroundImageReturn } from './composables/useBackgroundImage'
export { decodeBlurhash } from './utils/blurhash-decode'
export { decodeThumbHash, thumbHashToAverageRGBA, thumbHashToAverageColor } from './utils/thumbhash-decode'
export { encodeBlurhash, encodeThumbHash } from './utils/encode'
export type { EncodeSource, EncodeBlurhashOptions, EncodeThumbHashOptions } from './utils/encode'
export { generateSrcset, generateSizes, generateDensitySrcset, buildSizes, generatePreloadLink } from './utils/srcset'
export type {
  ImageStatus,
  SrcSet,
  ResponsiveSrc,
  BreakpointMap,
  VImageKitOptions,
  LazyImgOptions,
  ObjectFit,
  FocalPoint,
  Densities,
} from './types'

export const VImageKitPlugin = {
  install(app: App, options: VImageKitOptions = {}): void {
    app.provide(BREAKPOINTS_KEY, options.breakpoints ?? {})
    app.component('VImage', VImage)
    app.directive('lazy-img', vLazyImg)
  },
}

export default VImageKitPlugin
