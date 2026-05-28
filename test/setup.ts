import { vi } from 'vitest'

const mockCtx = {
  putImageData: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any
