<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImage } from '../composables/useImage'
import { useBreakpoints } from '../composables/useBreakpoints'
import { useActiveMediaSource } from '../composables/useActiveMediaSource'
import { useNetworkAware } from '../composables/useNetworkAware'
import { decodeBlurhash } from '../utils/blurhash-decode'
import { decodeThumbHash, thumbHashToAverageColor } from '../utils/thumbhash-decode'
import { pickSmallestSrcsetUrl } from '../utils/srcset'
import { checkAltText, isDevMode } from '../utils/a11y'
import { autoLoader, autoSrcset } from '../cdn/auto'
import type { AutoLoaderConfig } from '../cdn/auto'
import { useServerRoute } from '../composables/useServerLoader'
import { buildImageUrl } from '../server/url'
import type {
  SrcSet,
  ResponsiveSrc,
  ObjectFit,
  BreakpointMap,
  FocalPoint,
  Densities,
  ImageMeta,
  Layout,
} from '../types'

interface Props {
  src?: string | SrcSet
  image?: ImageMeta
  alt: string
  width?: number
  height?: number
  blurhash?: string
  thumbhash?: string
  placeholder?: string
  placeholderMode?: 'blur' | 'color' | 'shimmer'
  placeholderColor?: string
  widths?: number[]
  densities?: Densities
  sizes?: string
  breakpoints?: BreakpointMap
  sources?: ResponsiveSrc
  lazy?: boolean
  rootMargin?: string
  threshold?: number
  fit?: ObjectFit
  focal?: FocalPoint
  maxRetries?: number
  retryDelay?: number
  fetchpriority?: 'high' | 'low' | 'auto'
  decoding?: 'async' | 'sync' | 'auto'
  priority?: boolean
  respectSaveData?: boolean
  layout?: Layout
  cdn?: boolean | AutoLoaderConfig
  loader?: 'server'
  loaderRoute?: string
  fadeIn?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lazy: true,
  rootMargin: '200px',
  threshold: 0,
  decoding: 'async',
  priority: false,
  respectSaveData: false,
  fadeIn: false,
})

const emit = defineEmits<{
  load: [e: Event]
  error: [e: Event]
}>()

const isSSR = typeof window === 'undefined'
const isHydrating = ref(true)

const observeTargetRef = ref<HTMLElement | null>(null)

const network = props.respectSaveData ? useNetworkAware() : null
const isSavingData = computed(() => !!props.respectSaveData && !!network?.saveData.value)

const saveDataSrc = computed<string | undefined>(() => {
  if (!isSavingData.value) return undefined
  if (props.densities && !Array.isArray(props.densities)) {
    const keys = Object.keys(props.densities).map(Number)
    if (keys.length > 0) return props.densities[Math.min(...keys)]
  }
  if (props.image?.srcset) return pickSmallestSrcsetUrl(props.image.srcset)
  return undefined
})

const mergedSrc = computed<string | SrcSet>(() => {
  if (saveDataSrc.value) return saveDataSrc.value
  if (props.src !== undefined) return props.src
  if (props.image) {
    return props.image.webp || props.image.avif
      ? {
          ...(props.image.avif !== undefined ? { avif: props.image.avif } : {}),
          ...(props.image.webp !== undefined ? { webp: props.image.webp } : {}),
          fallback: props.image.src,
        }
      : props.image.src
  }
  return ''
})
if (isDevMode()) {
  const altIssue = checkAltText(props.alt)
  if (altIssue) {
    const srcForMessage =
      typeof mergedSrc.value === 'string' ? mergedSrc.value : mergedSrc.value.fallback
    console.warn(`[vue-image-kit] VImage: alt ${altIssue} (src: "${srcForMessage}")`)
  }
}

const cdnConfig = computed<AutoLoaderConfig>(() => (typeof props.cdn === 'object' ? props.cdn : {}))

const cdnSrc = computed<string | undefined>(() => {
  if (!props.cdn || typeof mergedSrc.value !== 'string') return undefined
  return autoLoader(mergedSrc.value, {}, cdnConfig.value)
})

const cdnSrcset = computed<string | undefined>(() => {
  if (!props.cdn || !props.widths?.length || typeof mergedSrc.value !== 'string') return undefined
  return autoSrcset(mergedSrc.value, props.widths, {}, cdnConfig.value)
})

const serverRoute = props.loader === 'server' ? useServerRoute(props.loaderRoute) : ''

const serverSrc = computed<string | undefined>(() => {
  if (props.cdn || props.loader !== 'server' || typeof mergedSrc.value !== 'string')
    return undefined
  return buildImageUrl(mergedSrc.value, {}, serverRoute)
})

const serverSrcset = computed<string | undefined>(() => {
  if (
    props.cdn ||
    props.loader !== 'server' ||
    !props.widths?.length ||
    typeof mergedSrc.value !== 'string'
  )
    return undefined
  const src = mergedSrc.value
  return props.widths
    .map((w) => `${buildImageUrl(src, { width: w }, serverRoute)} ${w}w`)
    .join(', ')
})

const mergedWidth = computed(() => props.width ?? props.image?.width)
const mergedHeight = computed(() => props.height ?? props.image?.height)
const mergedBlurhash = computed(() => props.blurhash ?? props.image?.blurhash)
const mergedThumbhash = computed(() => props.thumbhash ?? props.image?.thumbhash)
const mergedPlaceholder = computed(() => props.placeholder ?? props.image?.placeholder)

const autoSizes = computed(() => {
  if (props.layout === 'fill' || props.layout === 'fixed' || !mergedWidth.value) return undefined
  return `(min-width: ${mergedWidth.value}px) ${mergedWidth.value}px, 100vw`
})
const mergedSizes = computed(() => props.sizes ?? props.image?.sizes ?? autoSizes.value)

const effectivePriority = computed(() => props.priority && !isSavingData.value)
const effectiveLazy = computed(() => (effectivePriority.value ? false : props.lazy))
const effectiveFetchpriority = computed(() =>
  effectivePriority.value ? 'high' : props.fetchpriority,
)
const effectiveDecoding = computed(() => (effectivePriority.value ? 'sync' : props.decoding))

const effectiveRawSrcset = computed(() => {
  if (isSavingData.value) return undefined
  if (cdnSrcset.value !== undefined) return cdnSrcset.value
  if (serverSrcset.value !== undefined) return serverSrcset.value
  if (props.widths === undefined && props.image?.srcset) return props.image.srcset
  return undefined
})

const { status, isLoaded, isError, imgAttrs, observe, onImgLoad, onImgError } = useImage({
  src: cdnSrc.value ?? serverSrc.value ?? mergedSrc.value,
  ...(effectiveRawSrcset.value === undefined && props.widths !== undefined
    ? { widths: props.widths }
    : {}),
  ...(props.densities !== undefined && !isSavingData.value ? { densities: props.densities } : {}),
  ...(mergedSizes.value !== undefined ? { sizes: mergedSizes.value } : {}),
  ...(effectiveRawSrcset.value !== undefined ? { rawSrcset: effectiveRawSrcset.value } : {}),
  lazy: effectiveLazy.value,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
  ...(props.fit !== undefined ? { fit: props.fit } : {}),
  ...(props.maxRetries !== undefined ? { maxRetries: props.maxRetries } : {}),
  ...(props.retryDelay !== undefined ? { retryDelay: props.retryDelay } : {}),
})

const isIdle = computed(() => status.value === 'idle')

const { resolveMediaSources } = useBreakpoints(props.breakpoints)
const mediaSources = computed(() => resolveMediaSources(props.sources))

const activeMediaSource = useActiveMediaSource(mediaSources)
const effectiveWidth = computed(() => activeMediaSource.value?.width ?? mergedWidth.value)
const effectiveHeight = computed(() => activeMediaSource.value?.height ?? mergedHeight.value)

const srcObject = computed(() => (typeof mergedSrc.value === 'object' ? mergedSrc.value : null))
const needsPicture = computed(() => srcObject.value !== null || mediaSources.value.length > 0)

const objectPosition = computed(() => {
  if (!props.focal) return undefined
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return `${clamp(props.focal.x) * 100}% ${clamp(props.focal.y) * 100}%`
})

const colorPlaceholder = computed(() => {
  if (props.placeholderColor) return props.placeholderColor
  if (props.placeholderMode === 'color' && mergedThumbhash.value) {
    return thumbHashToAverageColor(mergedThumbhash.value)
  }
  return undefined
})

const isShimmer = computed(() => props.placeholderMode === 'shimmer' && !colorPlaceholder.value)
const showShimmerClass = computed(() => isShimmer.value && !isLoaded.value && !isError.value)

const effectivePlaceholder = computed(() => {
  if (colorPlaceholder.value) return undefined
  if (props.placeholderMode === 'color' || props.placeholderMode === 'shimmer') return undefined
  if (mergedBlurhash.value && effectiveWidth.value && effectiveHeight.value) return undefined
  if (mergedPlaceholder.value) return mergedPlaceholder.value
  if (mergedThumbhash.value) return decodeThumbHash(mergedThumbhash.value)
  return undefined
})

function blurhashToDataUrl(hash: string, width: number, height: number): string | undefined {
  const decodeWidth = 32
  const decodeHeight = Math.max(1, Math.round(decodeWidth * (height / width)))
  try {
    const pixels = decodeBlurhash(hash, decodeWidth, decodeHeight)
    const canvas = document.createElement('canvas')
    canvas.width = decodeWidth
    canvas.height = decodeHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.putImageData(new ImageData(pixels, decodeWidth, decodeHeight), 0, 0)
    return canvas.toDataURL()
  } catch {
    return undefined
  }
}

const blurhashDataUrl = computed<string | undefined>(() => {
  if (isSSR) return undefined
  if (!mergedBlurhash.value || !effectiveWidth.value || !effectiveHeight.value) return undefined
  return blurhashToDataUrl(mergedBlurhash.value, effectiveWidth.value, effectiveHeight.value)
})

const placeholderBackgroundStyle = computed(() => {
  if (isLoaded.value) return {}
  if (colorPlaceholder.value) {
    return { backgroundColor: colorPlaceholder.value }
  }
  if (isShimmer.value) {
    return {}
  }
  if (blurhashDataUrl.value) {
    return {
      backgroundImage: `url(${blurhashDataUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: objectPosition.value ?? 'center',
    }
  }
  if (effectivePlaceholder.value) {
    return {
      backgroundImage: `url(${effectivePlaceholder.value})`,
      backgroundSize: 'cover',
      backgroundPosition: objectPosition.value ?? 'center',
    }
  }
  return { backgroundColor: '#f3f4f6' }
})

const mountedOpacity = ref(false)
onMounted(() => {
  isHydrating.value = false
  if (props.fadeIn) {
    requestAnimationFrame(() => {
      mountedOpacity.value = true
    })
  }
  if (effectiveLazy.value) {
    observe(observeTargetRef)
  }
})

const fadeStyle = computed(() =>
  props.fadeIn
    ? { opacity: mountedOpacity.value ? '1' : '0', transition: 'opacity 0.3s ease' }
    : {},
)

const aspectRatio = computed(() => {
  if (effectiveWidth.value && effectiveHeight.value) {
    return `${effectiveWidth.value} / ${effectiveHeight.value}`
  }
  return undefined
})

const boxStyle = computed(() => {
  if (props.layout === 'fill') {
    return {
      position: 'absolute' as const,
      inset: '0',
      display: 'block' as const,
      width: '100%',
      height: '100%',
    }
  }
  if (props.layout === 'fixed' && effectiveWidth.value && effectiveHeight.value) {
    return {
      display: 'inline-block' as const,
      width: `${effectiveWidth.value}px`,
      height: `${effectiveHeight.value}px`,
    }
  }
  if (effectiveWidth.value && effectiveHeight.value) {
    return {
      display: 'block' as const,
      width: '100%',
      height: 'auto',
      aspectRatio: aspectRatio.value,
    }
  }
  return { display: 'block' as const }
})

const idleStyle = computed(() => ({
  ...boxStyle.value,
  ...placeholderBackgroundStyle.value,
  ...fadeStyle.value,
}))

const isFillLayout = computed(() => props.layout === 'fill')
const isFixedLayout = computed(() => props.layout === 'fixed')
const isResponsiveSized = computed(
  () =>
    !isFillLayout.value &&
    !isFixedLayout.value &&
    !!(effectiveWidth.value && effectiveHeight.value),
)

const loadedBoxClasses = computed(() => ({
  'vik-box': true,
  'vik-box--fill': isFillLayout.value,
  'vik-box--fixed': isFixedLayout.value,
  'vik-box--responsive': isResponsiveSized.value,
}))

const errorClasses = computed(() => ({ ...loadedBoxClasses.value, 'vik-box--error': true }))

const fixedSizeStyle = computed(() => {
  if (!isFixedLayout.value || !effectiveWidth.value || !effectiveHeight.value) return {}
  return { width: `${effectiveWidth.value}px`, height: `${effectiveHeight.value}px` }
})

const isBoxConstrained = computed(
  () => isFillLayout.value || isFixedLayout.value || isResponsiveSized.value,
)

const usesDefaultFit = computed(() => !props.fit && isBoxConstrained.value)

const fitStyle = computed(() => (props.fit ? { objectFit: props.fit } : {}))

const realImgStyle = computed(() => ({
  ...fixedSizeStyle.value,
  ...fitStyle.value,
  ...(objectPosition.value ? { objectPosition: objectPosition.value } : {}),
  ...placeholderBackgroundStyle.value,
  ...fadeStyle.value,
}))

function handleLoad(e: Event): void {
  onImgLoad()
  emit('load', e)
}

function handleError(e: Event): void {
  onImgError()
  emit('error', e)
}
</script>

<template>
  <img
    v-if="isHydrating"
    v-bind="imgAttrs"
    :alt="alt"
    :width="mergedWidth"
    :height="mergedHeight"
    :decoding="effectiveDecoding"
    :fetchpriority="effectiveFetchpriority"
    :loading="effectiveLazy ? 'lazy' : 'eager'"
  />

  <span
    v-else-if="isIdle"
    ref="observeTargetRef"
    :style="idleStyle"
    :class="{ 'vik-shimmer': showShimmerClass }"
    aria-hidden="true"
  />

  <span v-else-if="isError" :class="errorClasses">
    <slot name="error">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9ca3af"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </slot>
  </span>

  <picture v-else-if="needsPicture" :class="loadedBoxClasses">
    <source
      v-for="s in mediaSources"
      :key="`${s.media}|${s.type ?? ''}`"
      :media="s.media"
      :srcset="s.src"
      :type="s.type"
      :width="s.width"
      :height="s.height"
      :sizes="s.sizes"
    />
    <source v-if="srcObject?.avif" :srcset="srcObject.avif" type="image/avif" />
    <source v-if="srcObject?.webp" :srcset="srcObject.webp" type="image/webp" />

    <img
      v-bind="imgAttrs"
      :alt="alt"
      :width="mergedWidth"
      :height="mergedHeight"
      :decoding="effectiveDecoding"
      :fetchpriority="effectiveFetchpriority"
      :style="realImgStyle"
      :class="[loadedBoxClasses, { 'vik-fit': usesDefaultFit, 'vik-shimmer': showShimmerClass }]"
      @load="handleLoad"
      @error="handleError"
    />
  </picture>

  <img
    v-else
    v-bind="imgAttrs"
    :alt="alt"
    :width="mergedWidth"
    :height="mergedHeight"
    :decoding="effectiveDecoding"
    :fetchpriority="effectiveFetchpriority"
    :style="realImgStyle"
    :class="[loadedBoxClasses, { 'vik-fit': usesDefaultFit, 'vik-shimmer': showShimmerClass }]"
    @load="handleLoad"
    @error="handleError"
  />
</template>

<style>
.vik-box {
  display: block;
}

.vik-box--responsive {
  width: 100%;
  height: auto;
}

.vik-box--fill {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.vik-box--fixed {
  display: inline-block;
}

.vik-box--error {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e5e7eb;
}

.vik-fit {
  object-fit: cover;
}
</style>

<style scoped>
.vik-shimmer {
  background-image: linear-gradient(
    90deg,
    rgb(255, 255, 255, 0) 20%,
    rgb(255, 255, 255, 0.85) 50%,
    rgb(255, 255, 255, 0) 80%
  );
  background-color: #e2e5ea;
  background-repeat: no-repeat;
  background-size: 200% 100%;
  animation: vik-shimmer 1.3s ease-in-out infinite;
}

@keyframes vik-shimmer {
  0% {
    background-position: 180% 0;
  }

  100% {
    background-position: -80% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vik-shimmer {
    animation: none;
  }
}
</style>
