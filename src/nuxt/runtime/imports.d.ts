// Ambient stub for Nitro's auto-import virtual module, scoped to what
// server-handler.ts actually uses. Same reasoning as app.d.ts: this package
// doesn't depend on `nuxt`/`nitropack` itself, so there's no real `#imports`
// module to resolve against during this repo's own typecheck — the real
// implementation is supplied by the consuming Nuxt app at its own build time.
declare module '#imports' {
  import type { IncomingMessage, ServerResponse } from 'node:http'

  interface H3Event {
    node: {
      req: IncomingMessage
      res: ServerResponse
    }
  }

  export function defineEventHandler(
    handler: (event: H3Event) => unknown | Promise<unknown>,
  ): unknown

  export function useRuntimeConfig(): Record<string, unknown>
}
