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
