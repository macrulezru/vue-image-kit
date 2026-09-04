import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { VImageKitPlugin } from '@macrulez/vue-image-kit'
import type { BreakpointMap } from '@macrulez/vue-image-kit'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const vueImageKit = config.public.vueImageKit as { breakpoints?: BreakpointMap; serverRoute?: string } | undefined
  const breakpoints = vueImageKit?.breakpoints ?? {}

  nuxtApp.vueApp.use(VImageKitPlugin, {
    breakpoints,
    ...(vueImageKit?.serverRoute !== undefined ? { serverRoute: vueImageKit.serverRoute } : {}),
  })
})
