import { vi } from 'vitest'

if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataPolyfill {
    data: Uint8ClampedArray
    width: number
    height: number
    constructor(data: Uint8ClampedArray, width: number, height?: number) {
      this.data = data
      this.width = width
      this.height = height ?? data.length / (4 * width)
    }
  }
  globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData
}

let lastPutImageData: { data: Uint8ClampedArray } | null = null

const mockCtx = {
  putImageData: vi.fn((imageData: { data: Uint8ClampedArray }) => {
    lastPutImageData = imageData
  }),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
  const bytes = lastPutImageData?.data ?? new Uint8ClampedArray(0)
  let sum = 0
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i] * (i + 1)) % 100000
  return `data:image/png;base64,MOCK${sum}`
}) as unknown as typeof HTMLCanvasElement.prototype.toDataURL
