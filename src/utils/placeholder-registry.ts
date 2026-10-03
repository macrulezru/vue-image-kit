import type { PlaceholderEntry } from '../types'

export interface RegisteredPlaceholder {
  blurhash?: string
  thumbhash?: string
  color?: string
  placeholderColor?: string
  width?: number
  height?: number
}

const registry = new Map<string, PlaceholderEntry>()

export function registerPlaceholder(src: string, data: RegisteredPlaceholder): void {
  if (typeof src !== 'string' || src === '') return
  const entry: PlaceholderEntry = {}
  if (data.blurhash) entry.blurhash = data.blurhash
  if (data.thumbhash) entry.thumbhash = data.thumbhash
  const color = data.color ?? data.placeholderColor
  if (color) entry.color = color
  if (data.width !== undefined && data.height !== undefined) {
    entry.width = data.width
    entry.height = data.height
  }
  if (Object.keys(entry).length > 0) registry.set(src, entry)
}

export function lookupRegisteredPlaceholder(src: string | undefined): PlaceholderEntry | undefined {
  return src ? registry.get(src) : undefined
}
