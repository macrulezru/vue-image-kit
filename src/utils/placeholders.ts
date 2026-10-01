import type { InjectionKey } from 'vue'
import type { PlaceholderManifest } from '../types'

export const PLACEHOLDERS_KEY: InjectionKey<PlaceholderManifest> = Symbol(
  'vue-image-kit-placeholders',
)
