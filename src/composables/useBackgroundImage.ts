import { ref, computed, onMounted, watch } from 'vue'
import type { Ref, ComputedRef, StyleValue } from 'vue'
import { useLazyLoad } from './useLazyLoad'
import type { ImageStatus } from '../types'

export interface UseBackgroundImageOptions {
  placeholder?: string
  densities?: number[]
  type?: string
  lazy?: boolean
  rootMargin?: string
  threshold?: number
  transition?: string
  backgroundSize?: string
  backgroundPosition?: string
}

export interface UseBackgroundImageReturn {
  target: Ref<HTMLElement | null>
  style: ComputedRef<StyleValue>
  status: Ref<ImageStatus>
  isLoaded: ComputedRef<boolean>
  isLoading: ComputedRef<boolean>
  load: () => void
}

function buildBackgroundImage(src: string, densities?: number[], type?: string): string {
  if (!densities || densities.length === 0) return `url("${src}")`
  const typePart = type ? ` type("${type}")` : ''
  const entries = densities.map((d) => `url("${src}")${typePart} ${d}x`).join(', ')
  return `image-set(${entries})`
}

export function useBackgroundImage(
  src: string,
  options: UseBackgroundImageOptions = {},
): UseBackgroundImageReturn {
  const {
    placeholder,
    densities,
    type,
    lazy = true,
    rootMargin = '200px',
    threshold = 0,
    transition = '0.4s ease',
    backgroundSize = 'cover',
    backgroundPosition = 'center',
  } = options

  const target = ref<HTMLElement | null>(null)
  const status = ref<ImageStatus>('idle')
  const isLoaded = computed(() => status.value === 'loaded')
  const isLoading = computed(() => status.value === 'loading')

  const fullImage = buildBackgroundImage(src, densities, type)

  function load(): void {
    if (status.value === 'loaded' || status.value === 'loading') return
    if (typeof window === 'undefined') return
    status.value = 'loading'
    const img = new Image()
    img.onload = () => {
      status.value = 'loaded'
    }
    img.onerror = () => {
      status.value = 'error'
    }
    img.src = src
  }

  const { isIntersecting, observe } = useLazyLoad({ rootMargin, threshold })

  onMounted(() => {
    if (lazy) {
      observe(target)
    } else {
      load()
    }
  })

  watch(isIntersecting, (visible) => {
    if (visible && status.value === 'idle') load()
  })

  const baseStyle = {
    backgroundSize,
    backgroundPosition,
    backgroundRepeat: 'no-repeat',
  } as const

  const style = computed<StyleValue>(() => {
    if (isLoaded.value) {
      return {
        ...baseStyle,
        backgroundImage: fullImage,
        filter: '',
        transform: '',
        transition: `filter ${transition}, transform ${transition}`,
      }
    }
    if (placeholder) {
      return {
        ...baseStyle,
        backgroundImage: `url("${placeholder}")`,
        filter: 'blur(8px)',
        transform: 'scale(1.05)',
        transition: `filter ${transition}, transform ${transition}`,
      }
    }
    return baseStyle
  })

  return { target, style, status, isLoaded, isLoading, load }
}
