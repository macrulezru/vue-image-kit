<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useImage } from '../composables/useImage'
import { useBlurhash } from '../composables/useBlurhash'
import { useBreakpoints } from '../composables/useBreakpoints'
import { decodeThumbHash } from '../utils/thumbhash-decode'
import type { SrcSet, ResponsiveSrc, ObjectFit, BreakpointMap } from '../types'

interface Props {
  src: string | SrcSet
  alt: string
  width?: number
  height?: number
  blurhash?: string
  thumbhash?: string
  placeholder?: string
  widths?: number[]
  sizes?: string
  breakpoints?: BreakpointMap
  sources?: ResponsiveSrc
  lazy?: boolean
  rootMargin?: string
  threshold?: number
  fit?: ObjectFit
  maxRetries?: number
  retryDelay?: number
  fetchpriority?: 'high' | 'low' | 'auto'
  decoding?: 'async' | 'sync' | 'auto'
}

const props = withDefaults(defineProps<Props>(), {
  lazy: true,
  rootMargin: '200px',
  threshold: 0,
  fit: 'cover',
  decoding: 'async',
})

const emit = defineEmits<{
  load: [e: Event]
  error: [e: Event]
}>()

const isSSR = typeof window === 'undefined'

const wrapperRef = ref<HTMLElement | null>(null)

const { status, isLoaded, isError, imgAttrs, observe, onImgLoad, onImgError } = useImage({
  src: props.src,
  ...(props.widths !== undefined ? { widths: props.widths } : {}),
  ...(props.sizes !== undefined ? { sizes: props.sizes } : {}),
  lazy: props.lazy,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
  fit: props.fit,
  ...(props.maxRetries !== undefined ? { maxRetries: props.maxRetries } : {}),
  ...(props.retryDelay !== undefined ? { retryDelay: props.retryDelay } : {}),
})

const blurhashCanvas = props.blurhash && props.width && props.height
  ? useBlurhash({
      blurhash: props.blurhash,
      width: props.width,
      height: props.height,
    })
  : ref(null)

const { resolveMediaSources } = useBreakpoints(props.breakpoints)

const mediaSources = computed(() => resolveMediaSources(props.sources))

onMounted(() => {
  if (props.lazy) {
    observe(wrapperRef)
  }
})

const effectivePlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  if (props.thumbhash) return decodeThumbHash(props.thumbhash)
  return undefined
})

const aspectRatio = computed(() => {
  if (props.width && props.height) {
    return `${props.width} / ${props.height}`
  }
  return undefined
})

const wrapperStyle = computed(() => ({
  position: 'relative' as const,
  overflow: 'hidden' as const,
  display: 'block' as const,
  ...(aspectRatio.value ? { aspectRatio: aspectRatio.value } : {}),
}))

const srcObject = computed(() => (typeof props.src === 'object' ? props.src : null))

const isLoading = computed(() => status.value === 'loading')
const isIdle = computed(() => status.value === 'idle')
const showPlaceholder = computed(() => !isLoaded.value && !isError.value && !!effectivePlaceholder.value)

// <picture> нужен когда есть форматы или адаптивные источники
const needsPicture = computed(() =>
  srcObject.value !== null || mediaSources.value.length > 0
)

const imgStyle = computed(() => ({
  objectFit: props.fit,
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
    :width="width"
    :height="height"
    :decoding="decoding"
    :fetchpriority="fetchpriority"
    :loading="lazy ? 'lazy' : 'eager'"
  />

  <span v-else ref="wrapperRef" :style="wrapperStyle">
    <!-- Blurhash canvas placeholder -->
    <canvas
      v-if="blurhash && width && height && !isError"
      ref="blurhashCanvas"
      :width="width"
      :height="height"
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
        :key="s.media"
        :media="s.media"
        :srcset="s.src"
      />

      <!-- Форматные источники AVIF/WebP -->
      <source v-if="srcObject?.avif" :srcset="srcObject.avif" type="image/avif" />
      <source v-if="srcObject?.webp" :srcset="srcObject.webp" type="image/webp" />

      <img
        v-bind="imgAttrs"
        :alt="alt"
        :width="width"
        :height="height"
        :decoding="decoding"
        :fetchpriority="fetchpriority"
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
      :width="width"
      :height="height"
      :decoding="decoding"
      :fetchpriority="fetchpriority"
      :style="imgStyle"
      @load="handleLoad"
      @error="handleError"
    />

    <!-- Пустой placeholder когда нет blurhash/lqip -->
    <span
      v-if="isIdle && !blurhash && !effectivePlaceholder"
      style="position: absolute; inset: 0; background: #f3f4f6; width: 100%; height: 100%;"
      aria-hidden="true"
    />
  </span>
</template>
