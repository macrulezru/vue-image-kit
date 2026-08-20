// Registered via `addServerHandler` in ../module.ts when `onDemandServer` is
// enabled. Thin h3/Nitro wrapper around the framework-agnostic handler from
// `vue-image-kit/server` — `event.node.req`/`res` are the real Node
// IncomingMessage/ServerResponse, so the same handler that works for plain
// Node http or Express works here unchanged.
import { defineEventHandler, useRuntimeConfig } from '#imports'
import { createImageHandler } from '../../server/handler.js'
import type { ImageHandler, ImageHandlerOptions } from '../../server/handler.js'

let handler: ImageHandler | null = null

export default defineEventHandler(async (event) => {
  if (!handler) {
    const options = useRuntimeConfig().vueImageKitServer as ImageHandlerOptions
    handler = createImageHandler(options)
  }
  await handler(event.node.req, event.node.res)
})
