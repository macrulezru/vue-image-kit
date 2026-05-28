declare module '#app' {
  import type { App } from 'vue'

  interface NuxtApp {
    vueApp: App
  }

  interface RuntimeConfig {
    public: Record<string, any>
  }

  export function defineNuxtPlugin(fn: (nuxtApp: NuxtApp) => void): (nuxtApp: NuxtApp) => void
  export function useRuntimeConfig(): RuntimeConfig
}
