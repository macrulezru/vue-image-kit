import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import { decodeBlurhash } from '../utils/blurhash-decode'

// Blurhash is always decoded at thumbnail size — CSS scales it up.
// Decoding at the original image resolution (e.g. 1200×800) would mean
// computing 960 000 pixels per component instead of ~672.
const DECODE_WIDTH = 32

interface UseBlurhashOptions {
  blurhash: string
  width: number
  height: number
}

export function useBlurhash(options: UseBlurhashOptions): Ref<HTMLCanvasElement | null> {
  const canvasRef = ref<HTMLCanvasElement | null>(null)

  if (typeof window === 'undefined') {
    return canvasRef
  }

  onMounted(() => {
    const { blurhash, width, height } = options
    if (!blurhash || !canvasRef.value) return

    const canvas = canvasRef.value
    const decodeW = DECODE_WIDTH
    const decodeH = Math.max(1, Math.round(DECODE_WIDTH * (height / width)))

    canvas.width = decodeW
    canvas.height = decodeH

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    try {
      const pixels = decodeBlurhash(blurhash, decodeW, decodeH)
      const imageData = new ImageData(pixels, decodeW, decodeH)
      ctx.putImageData(imageData, 0, 0)
    } catch {
      // invalid blurhash — leave canvas blank
    }
  })

  return canvasRef
}
