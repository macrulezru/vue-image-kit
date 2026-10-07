type HazehashModule = typeof import('hazehash')

let loading: Promise<HazehashModule | null> | undefined
let warned = false

export function loadHazehash(): Promise<HazehashModule | null> {
  loading ??= import('hazehash').catch(() => {
    if (!warned) {
      warned = true
      console.warn(
        '[vue-image-kit] a hazehash placeholder is set, but the "hazehash" package is not installed — ' +
          'run `npm install hazehash`; the next placeholder in line is used instead',
      )
    }
    return null
  })
  return loading
}

export async function hazehashToDataUrl(hash: string, size = 32): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined
  const module = await loadHazehash()
  if (!module) return undefined
  try {
    const { width, height, data } = module.decode(hash, { size })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return undefined
    context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)
    return canvas.toDataURL()
  } catch {
    return undefined
  }
}
