import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { VImageKitPlugin } from 'vue-image-kit'
import type { BreakpointMap } from 'vue-image-kit'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const breakpoints = (config.public.vueImageKit?.breakpoints ?? {}) as BreakpointMap

  nuxtApp.vueApp.use(VImageKitPlugin, { breakpoints })
})
