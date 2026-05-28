import { ref, computed, watch, onMounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useLazyLoad } from './useLazyLoad'
import { generateSrcset, generateSizes } from '../utils/srcset'
import type { ImageStatus, SrcSet, ObjectFit } from '../types'

interface UseImageOptions {
  src: string | SrcSet
  widths?: number[]
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
    const srcset = widths.length > 0 ? generateSrcset(fallbackSrc, widths) : undefined
    const sizesAttr = srcset ? generateSizes(sizes) : undefined
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
