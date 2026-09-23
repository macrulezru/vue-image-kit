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
