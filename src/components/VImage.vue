<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImage } from '../composables/useImage'
import { useBlurhash } from '../composables/useBlurhash'
import { useBreakpoints } from '../composables/useBreakpoints'
import { useNetworkAware } from '../composables/useNetworkAware'
import { decodeThumbHash, thumbHashToAverageColor } from '../utils/thumbhash-decode'
import { pickSmallestSrcsetUrl } from '../utils/srcset'
import { checkAltText, isDevMode } from '../utils/a11y'
import { autoLoader, autoSrcset } from '../cdn/auto'
import type { AutoLoaderConfig } from '../cdn/auto'
import { useServerRoute } from '../composables/useServerLoader'
import { buildImageUrl } from '../server/url'
import type { SrcSet, ResponsiveSrc, ObjectFit, BreakpointMap, FocalPoint, Densities, ImageMeta, Layout } from '../types'

interface Props {
  src?: string | SrcSet
  /** Build-time metadata (CLI manifest entry or `?vik` import) seeding src/width/height/blurhash/thumbhash/placeholder/sizes. Any explicit prop above overrides the matching field here. */
  image?: ImageMeta
  alt: string
  width?: number
  height?: number
  blurhash?: string
  thumbhash?: string
  placeholder?: string
  /** Placeholder style: 'blur' (default) shows blurhash/LQIP/ThumbHash; 'color' shows a solid average color; 'shimmer' shows an animated skeleton. */
  placeholderMode?: 'blur' | 'color' | 'shimmer'
  /** Explicit solid CSS color placeholder. Takes precedence and needs no decode. */
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
  /** Shorthand for the LCP/hero image: forces lazy=false, fetchpriority='high', decoding='sync'. Not automatic detection — mark the one image that matters. */
  priority?: boolean
  /** Opt-in: on a save-data connection, neutralize `priority` (stays lazy), downgrade `src` to the smallest URL available from `densities`/`image.srcset`, and drop any `densities`/CDN/server/manifest `srcset` from the rendered `<img>` entirely — a browser picks from `srcset` over plain `src` whenever one is present, so leaving it in place would undo the downgrade. No effect otherwise. */
  respectSaveData?: boolean
  /** Wrapper sizing preset: 'fixed' (exact box), 'responsive' (fills container, auto `sizes`), 'fill' (absolutely fills a positioned parent). Unset keeps the current default (fills container width, no auto `sizes`). */
  layout?: Layout
  /** Opt-in: route a string `src` through `autoLoader()` — detects Cloudinary/imgix/Bunny/ImageKit/Sanity/Storyblok/Contentful/Gumlet from the URL's hostname and rewrites it with CDN transforms, no manual adapter wiring. `true` for hostname-only detection; pass an `AutoLoaderConfig` (`{ hosts }`) to also cover "your own domain" providers (Netlify/Vercel/Cloudflare/TwicPics). Combines with `widths` — each candidate gets its own CDN-transformed URL via the adapter's `.srcset()` instead of `widths`' usual same-URL-every-candidate. No effect on an unrecognized host (passthrough) or a `SrcSet`/`densities` src. */
  cdn?: boolean | AutoLoaderConfig
  /** Opt-in: route a string `src` through the `vue-image-kit/server` on-demand handler via `buildImageUrl()`, instead of using `src` as-is. Combines with `widths` the same way `cdn` does — one request URL per candidate width. If both `cdn` and `loader="server"` are set, `cdn` wins (an external CDN already resolves the image; the local on-demand server is the fallback for when there isn't one). */
  loader?: 'server'
  /** Route override for `loader="server"`, taking precedence over the plugin/module-level `serverRoute` default (`/_vik/image`). */
  loaderRoute?: string
}

const props = withDefaults(defineProps<Props>(), {
  lazy: true,
  rootMargin: '200px',
  threshold: 0,
  fit: 'cover',
  decoding: 'async',
  priority: false,
  respectSaveData: false,
})

const emit = defineEmits<{
  load: [e: Event]
  error: [e: Event]
}>()

const isSSR = typeof window === 'undefined'

const wrapperRef = ref<HTMLElement | null>(null)

const network = props.respectSaveData ? useNetworkAware() : null
const isSavingData = computed(() => !!props.respectSaveData && !!network?.saveData.value)

// On a save-data connection, downgrade to the smallest URL we can actually
// find one for — a distinct-URL `densities` map, or a manifest-provided
// `image.srcset`. Plain `widths` reuses the same URL for every candidate
// (see generateSrcset — browser-negotiated via the `w` descriptor, not
// URL-based), so there's nothing to downgrade to there.
const saveDataSrc = computed<string | undefined>(() => {
  if (!isSavingData.value) return undefined
  if (props.densities && !Array.isArray(props.densities)) {
    const keys = Object.keys(props.densities).map(Number)
    if (keys.length > 0) return props.densities[Math.min(...keys)]
  }
  if (props.image?.srcset) return pickSmallestSrcsetUrl(props.image.srcset)
  return undefined
})

// `image` (build-time metadata) fills in whatever an explicit prop didn't set.
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
    const srcForMessage = typeof mergedSrc.value === 'string' ? mergedSrc.value : mergedSrc.value.fallback
    console.warn(`[vue-image-kit] VImage: alt ${altIssue} (src: "${srcForMessage}")`)
  }
}

const cdnConfig = computed<AutoLoaderConfig>(() => (typeof props.cdn === 'object' ? props.cdn : {}))

// CDN integration only applies to a plain-string src — an explicit SrcSet
// object means the consumer already chose specific format URLs by hand.
const cdnSrc = computed<string | undefined>(() => {
  if (!props.cdn || typeof mergedSrc.value !== 'string') return undefined
  return autoLoader(mergedSrc.value, {}, cdnConfig.value)
})

// Real per-width URLs via the detected adapter's own .srcset(), instead of
// `widths`' usual "same URL, different w descriptor" (see generateSrcset).
// `undefined` (not the CDN-unchanged URL) when nothing was detected, so the
// widths-based path below still runs normally in that case.
const cdnSrcset = computed<string | undefined>(() => {
  if (!props.cdn || !props.widths?.length || typeof mergedSrc.value !== 'string') return undefined
  return autoSrcset(mergedSrc.value, props.widths, {}, cdnConfig.value)
})

// `loader="server"` is the local-server counterpart to `cdn` — same shape,
// same "plain-string src only" scope, same widths→per-candidate-URL upgrade.
// `cdn` wins when both are set (see the `loader` prop doc).
const serverRoute = props.loader === 'server' ? useServerRoute(props.loaderRoute) : ''

const serverSrc = computed<string | undefined>(() => {
  if (props.cdn || props.loader !== 'server' || typeof mergedSrc.value !== 'string') return undefined
  return buildImageUrl(mergedSrc.value, {}, serverRoute)
})

const serverSrcset = computed<string | undefined>(() => {
  if (props.cdn || props.loader !== 'server' || !props.widths?.length || typeof mergedSrc.value !== 'string') return undefined
  const src = mergedSrc.value
  return props.widths.map((w) => `${buildImageUrl(src, { width: w }, serverRoute)} ${w}w`).join(', ')
})

const mergedWidth = computed(() => props.width ?? props.image?.width)
const mergedHeight = computed(() => props.height ?? props.image?.height)
const mergedBlurhash = computed(() => props.blurhash ?? props.image?.blurhash)
const mergedThumbhash = computed(() => props.thumbhash ?? props.image?.thumbhash)
const mergedPlaceholder = computed(() => props.placeholder ?? props.image?.placeholder)

// `layout="responsive"` fills its container at up to its intrinsic width —
// a reasonable default `sizes` heuristic when none is given explicitly.
const autoSizes = computed(() => {
  if (props.layout !== 'responsive' || !mergedWidth.value) return undefined
  return `(min-width: ${mergedWidth.value}px) ${mergedWidth.value}px, 100vw`
})
const mergedSizes = computed(() => props.sizes ?? props.image?.sizes ?? autoSizes.value)

// `priority` is an explicit shorthand for the LCP image — not automatic
// detection (there's no reliable way to know that pre-paint), just three
// props bundled into one so the one hero image isn't three lines to mark.
// A save-data connection neutralizes it entirely: forcing eager/high-priority
// loading is the wrong call once the user asked to save data.
const effectivePriority = computed(() => props.priority && !isSavingData.value)
const effectiveLazy = computed(() => (effectivePriority.value ? false : props.lazy))
const effectiveFetchpriority = computed(() => (effectivePriority.value ? 'high' : props.fetchpriority))
const effectiveDecoding = computed(() => (effectivePriority.value ? 'sync' : props.decoding))

// On a save-data connection, `densities`/`rawSrcset` (CDN, server, or
// manifest srcset) must not reach useImage() at all: a browser that sees a
// valid `srcset`/density-descriptor set picks from *that*, ignoring plain
// `src` entirely — so leaving them in place would silently undo the
// downgrade `saveDataSrc` just computed (worst case: the exact densities-map
// case that downgrade exists for, since that's the one real per-file `2x`/
// `3x` candidate this component can offer).
const effectiveRawSrcset = computed(() => {
  if (isSavingData.value) return undefined
  if (cdnSrcset.value !== undefined) return cdnSrcset.value
  if (serverSrcset.value !== undefined) return serverSrcset.value
  if (props.widths === undefined && props.image?.srcset) return props.image.srcset
  return undefined
})

const { status, isLoaded, isError, imgAttrs, observe, onImgLoad, onImgError } = useImage({
  src: cdnSrc.value ?? serverSrc.value ?? mergedSrc.value,
  ...(effectiveRawSrcset.value === undefined && props.widths !== undefined ? { widths: props.widths } : {}),
  ...(props.densities !== undefined && !isSavingData.value ? { densities: props.densities } : {}),
  ...(mergedSizes.value !== undefined ? { sizes: mergedSizes.value } : {}),
  ...(effectiveRawSrcset.value !== undefined ? { rawSrcset: effectiveRawSrcset.value } : {}),
  lazy: effectiveLazy.value,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
  fit: props.fit,
  ...(props.maxRetries !== undefined ? { maxRetries: props.maxRetries } : {}),
  ...(props.retryDelay !== undefined ? { retryDelay: props.retryDelay } : {}),
})

const blurhashCanvas = mergedBlurhash.value && mergedWidth.value && mergedHeight.value
  ? useBlurhash({
      blurhash: mergedBlurhash.value,
      width: mergedWidth.value,
      height: mergedHeight.value,
    })
  : ref(null)

const { resolveMediaSources } = useBreakpoints(props.breakpoints)

const mediaSources = computed(() => resolveMediaSources(props.sources))

onMounted(() => {
  if (effectiveLazy.value) {
    observe(wrapperRef)
  }
})

// Solid-color placeholder: an explicit color always wins (no decode); otherwise
// 'color' mode derives the average RGBA straight from the ThumbHash header.
const colorPlaceholder = computed(() => {
  if (props.placeholderColor) return props.placeholderColor
  if (props.placeholderMode === 'color' && mergedThumbhash.value) {
    return thumbHashToAverageColor(mergedThumbhash.value)
  }
  return undefined
})

const effectivePlaceholder = computed(() => {
  // In color/shimmer mode the blur placeholder is suppressed — skip the (costly) decode.
  if (colorPlaceholder.value) return undefined
  if (props.placeholderMode === 'color' || props.placeholderMode === 'shimmer') return undefined
  if (mergedPlaceholder.value) return mergedPlaceholder.value
  if (mergedThumbhash.value) return decodeThumbHash(mergedThumbhash.value)
  return undefined
})

const aspectRatio = computed(() => {
  if (mergedWidth.value && mergedHeight.value) {
    return `${mergedWidth.value} / ${mergedHeight.value}`
  }
  return undefined
})

// 'fill' absolutely fills a positioned parent — width/height become
// irrelevant to sizing (inner elements already stretch to 100%/inset:0
// regardless of layout, see imgStyle/canvasStyle below).
// 'fixed' is an exact box at the intrinsic size, no responsive scaling.
// Unset/'responsive' both fill the container width with aspect-ratio
// preserved — the current default; 'responsive' additionally drives
// `autoSizes` above.
const wrapperStyle = computed(() => {
  if (props.layout === 'fill') {
    return {
      position: 'absolute' as const,
      inset: '0',
      overflow: 'hidden' as const,
      display: 'block' as const,
      width: '100%',
      height: '100%',
    }
  }
  if (props.layout === 'fixed' && mergedWidth.value && mergedHeight.value) {
    return {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      display: 'inline-block' as const,
      width: `${mergedWidth.value}px`,
      height: `${mergedHeight.value}px`,
    }
  }
  return {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    display: 'block' as const,
    ...(aspectRatio.value ? { aspectRatio: aspectRatio.value } : {}),
  }
})

// Focal point → object-position (fractions 0–1, clamped). Undefined leaves the
// browser default (center) so nothing is emitted unless `focal` is set.
const objectPosition = computed(() => {
  if (!props.focal) return undefined
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return `${clamp(props.focal.x) * 100}% ${clamp(props.focal.y) * 100}%`
})

const srcObject = computed(() => (typeof mergedSrc.value === 'object' ? mergedSrc.value : null))

const isLoading = computed(() => status.value === 'loading')
const isIdle = computed(() => status.value === 'idle')
const showPlaceholder = computed(() => !isLoaded.value && !isError.value && !!effectivePlaceholder.value)
const showColor = computed(() => !isLoaded.value && !isError.value && !!colorPlaceholder.value)
const isShimmer = computed(() => props.placeholderMode === 'shimmer' && !colorPlaceholder.value)
const showShimmer = computed(() => isShimmer.value && !isLoaded.value && !isError.value)

// <picture> нужен когда есть форматы или адаптивные источники
const needsPicture = computed(() =>
  srcObject.value !== null || mediaSources.value.length > 0
)

const imgStyle = computed(() => ({
  objectFit: props.fit,
  ...(objectPosition.value ? { objectPosition: objectPosition.value } : {}),
  width: '100%',
  height: '100%',
  opacity: isLoaded.value ? '1' : '0',
  transition: 'opacity 0.3s ease',
  position: 'absolute' as const,
  inset: '0',
}))

const placeholderStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  width: '100%',
  height: '100%',
  objectFit: props.fit,
  ...(objectPosition.value ? { objectPosition: objectPosition.value } : {}),
  filter: 'blur(20px)',
  transform: 'scale(1.05)',
  opacity: showPlaceholder.value ? '1' : '0',
  transition: 'opacity 0.3s ease',
}))

const canvasStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  width: '100%',
  height: '100%',
  opacity: showPlaceholder.value ? '1' : '0',
  transition: 'opacity 0.3s ease',
}))

const colorStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  width: '100%',
  height: '100%',
  backgroundColor: colorPlaceholder.value,
  opacity: showColor.value ? '1' : '0',
  transition: 'opacity 0.3s ease',
}))

const shimmerStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  width: '100%',
  height: '100%',
  opacity: showShimmer.value ? '1' : '0',
  transition: 'opacity 0.3s ease',
}))

function handleLoad(e: Event): void {
  onImgLoad()
  emit('load', e)
}

function handleError(e: Event): void {
  onImgError()
  emit('error', e)
}

const shouldRenderImg = computed(() => isLoading.value || isLoaded.value)
</script>

<template>
  <!-- SSR: простой img с нативной ленивой загрузкой -->
  <img
    v-if="isSSR"
    v-bind="imgAttrs"
    :alt="alt"
    :width="mergedWidth"
    :height="mergedHeight"
    :decoding="effectiveDecoding"
    :fetchpriority="effectiveFetchpriority"
    :loading="effectiveLazy ? 'lazy' : 'eager'"
  />

  <span v-else ref="wrapperRef" :style="wrapperStyle">
    <!-- Blurhash canvas placeholder -->
    <canvas
      v-if="mergedBlurhash && mergedWidth && mergedHeight && !isError && !colorPlaceholder && !isShimmer"
      ref="blurhashCanvas"
      :width="mergedWidth"
      :height="mergedHeight"
      :style="canvasStyle"
      aria-hidden="true"
    />

    <!-- LQIP / ThumbHash placeholder -->
    <img
      v-if="effectivePlaceholder && !isError"
      :src="effectivePlaceholder"
      :alt="''"
      :style="placeholderStyle"
      aria-hidden="true"
    />

    <!-- Solid average-color placeholder -->
    <span
      v-if="colorPlaceholder && !isError"
      :style="colorStyle"
      aria-hidden="true"
    />

    <!-- Animated skeleton/shimmer placeholder -->
    <span
      v-if="isShimmer && !isError"
      class="vik-shimmer"
      :style="shimmerStyle"
      aria-hidden="true"
    />

    <!-- Error state -->
    <span
      v-if="isError"
      style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #e5e7eb; width: 100%; height: 100%;"
    >
      <slot name="error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </slot>
    </span>

    <!-- Picture с адаптивными и форматными sources -->
    <picture
      v-if="shouldRenderImg && !isError && needsPicture"
      style="position: absolute; inset: 0; width: 100%; height: 100%;"
    >
      <!-- Адаптивные источники по медиа-правилам (art direction) -->
      <source
        v-for="s in mediaSources"
        :key="`${s.media}|${s.type ?? ''}`"
        :media="s.media"
        :srcset="s.src"
        :type="s.type"
      />

      <!-- Форматные источники AVIF/WebP -->
      <source v-if="srcObject?.avif" :srcset="srcObject.avif" type="image/avif" />
      <source v-if="srcObject?.webp" :srcset="srcObject.webp" type="image/webp" />

      <img
        v-bind="imgAttrs"
        :alt="alt"
        :width="mergedWidth"
        :height="mergedHeight"
        :decoding="effectiveDecoding"
        :fetchpriority="effectiveFetchpriority"
        :style="imgStyle"
        @load="handleLoad"
        @error="handleError"
      />
    </picture>

    <!-- Простой img без picture -->
    <img
      v-if="shouldRenderImg && !isError && !needsPicture"
      v-bind="imgAttrs"
      :alt="alt"
      :width="mergedWidth"
      :height="mergedHeight"
      :decoding="effectiveDecoding"
      :fetchpriority="effectiveFetchpriority"
      :style="imgStyle"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- Пустой placeholder когда нет blurhash/lqip/color/shimmer -->
    <span
      v-if="isIdle && !mergedBlurhash && !effectivePlaceholder && !colorPlaceholder && !isShimmer"
      style="position: absolute; inset: 0; background: #f3f4f6; width: 100%; height: 100%;"
      aria-hidden="true"
    />
  </span>
</template>

<style scoped>
.vik-shimmer {
  background: #e2e5ea linear-gradient(90deg, rgb(255, 255, 255, 0) 20%, rgb(255, 255, 255, 0.85) 50%, rgb(255, 255, 255, 0) 80%);
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
