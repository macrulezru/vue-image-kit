import { inject } from 'vue'
import type { InjectionKey } from 'vue'

export const SERVER_ROUTE_KEY: InjectionKey<string> = Symbol('vImageKitServerRoute')

export const DEFAULT_SERVER_ROUTE = '/_vik/image'

/** Resolves the on-demand server route: an explicit per-component override, then the plugin/module-level default, then the handler's own default. */
export function useServerRoute(localOverride?: string): string {
  if (localOverride) return localOverride
  return inject(SERVER_ROUTE_KEY, DEFAULT_SERVER_ROUTE)
}
