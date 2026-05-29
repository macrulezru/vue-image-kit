import { ref, computed, watch, onMounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useLazyLoad } from './useLazyLoad'
import { generateSrcset, generateSizes, generateDensitySrcset } from '../utils/srcset'
import type { ImageStatus, SrcSet, ObjectFit, Densities } from '../types'

interface UseImageOptions {
  src: string | SrcSet
  widths?: number[]
  densities?: Densities
  sizes?: string
  lazy?: boolean
  rootMargin?: string
  threshold?: number
  fit?: ObjectFit
  maxRetries?: number
  retryDelay?: number
}

interface ImgAttrs {
  src: string
  srcset?: string
  sizes?: string
  style: { objectFit: ObjectFit }
}

interface UseImageReturn {
  status: Ref<ImageStatus>
  isLoaded: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  imgAttrs: ComputedRef<ImgAttrs>
  observe: (el: Ref<HTMLElement | null>) => void
  onImgLoad: () => void
  onImgError: () => void
}

export function useImage(options: UseImageOptions): UseImageReturn {
  const {
    src,
    widths = [],
    densities,
    sizes,
    lazy = true,
    rootMargin = '200px',
    threshold = 0,
    fit = 'cover',
    maxRetries = 0,
    retryDelay = 1000,
  } = options

  const status = ref<ImageStatus>('idle')
  const isLoaded = computed(() => status.value === 'loaded')
  const isError = computed(() => status.value === 'error')
  let retryCount = 0

  const fallbackSrc = typeof src === 'string' ? src : src.fallback

  const imgAttrs = computed<ImgAttrs>(() => {
    // Density (x) descriptors take precedence over width (w) — they can't be
    // mixed, and `sizes` only applies to width-based candidates. `densities` is
    // either a list (reusing `src`) or a map of density → distinct URL.
    let srcset: string | undefined
    let sizesAttr: string | undefined
    const densityList = Array.isArray(densities)
      ? densities
      : densities
        ? Object.keys(densities).map(Number)
        : []
    if (densityList.length > 0) {
      const densitySrc = Array.isArray(densities) ? fallbackSrc : densities!
      srcset = generateDensitySrcset(densitySrc, densityList) || undefined
    } else if (widths.length > 0) {
      srcset = generateSrcset(fallbackSrc, widths) || undefined
      sizesAttr = srcset ? generateSizes(sizes) : undefined
    }
    return {
      src: fallbackSrc,
      ...(srcset !== undefined ? { srcset } : {}),
      ...(sizesAttr !== undefined ? { sizes: sizesAttr } : {}),
      style: { objectFit: fit },
    }
  })

  const { isIntersecting, observe } = useLazyLoad({ rootMargin, threshold })

  function startLoading(): void {
    status.value = 'loading'
  }

  function onImgLoad(): void {
    retryCount = 0
    status.value = 'loaded'
  }

  function onImgError(): void {
    if (retryCount < maxRetries) {
      retryCount++
      const delay = retryDelay * Math.pow(2, retryCount - 1) // exponential backoff
      setTimeout(() => {
        status.value = 'idle'
        setTimeout(() => { status.value = 'loading' }, 0)
      }, delay)
    } else {
      status.value = 'error'
    }
  }

  if (!lazy) {
    onMounted(() => {
      startLoading()
    })
  } else {
    watch(isIntersecting, (val) => {
      if (val && status.value === 'idle') {
        startLoading()
      }
    })
  }

  return { status, isLoaded, isError, imgAttrs, observe, onImgLoad, onImgError }
}
