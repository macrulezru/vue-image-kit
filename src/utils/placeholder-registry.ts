import type { PlaceholderEntry } from '../types'

export interface RegisteredPlaceholder {
  hazehash?: string
  blurhash?: string
  thumbhash?: string
  color?: string
  placeholderColor?: string
  placeholder?: string
  preview?: string
  width?: number
  height?: number
}

const STORE_KEY = '__VIK_PLACEHOLDERS__'

function store(): Map<string, RegisteredPlaceholder> {
  const host = globalThis as unknown as Record<string, Map<string, RegisteredPlaceholder> | undefined>
  return (host[STORE_KEY] ??= new Map())
}

function toEntry(data: RegisteredPlaceholder): PlaceholderEntry | undefined {
  const entry: PlaceholderEntry = {}
  if (data.hazehash) entry.hazehash = data.hazehash
  if (data.blurhash) entry.blurhash = data.blurhash
  if (data.thumbhash) entry.thumbhash = data.thumbhash
  const color = data.color ?? data.placeholderColor
  if (color) entry.color = color
  const preview = data.placeholder ?? data.preview
  if (preview) entry.placeholder = preview
  if (data.width !== undefined && data.height !== undefined) {
    entry.width = data.width
    entry.height = data.height
  }
  return Object.keys(entry).length > 0 ? entry : undefined
}

export function registerPlaceholder(src: string, data: RegisteredPlaceholder): void {
  if (typeof src !== 'string' || src === '') return
  store().set(src, data)
}

export function lookupRegisteredPlaceholder(src: string | undefined): PlaceholderEntry | undefined {
  const data = src ? store().get(src) : undefined
  return data ? toEntry(data) : undefined
}
