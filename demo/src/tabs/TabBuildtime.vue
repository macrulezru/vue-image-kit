<script setup lang="ts">
import { computed } from 'vue'
import { images } from '../assets/images'

// The object a `?vik` import returns is exactly a manifest entry (VikImageMeta).
const meta = computed(() => {
  const m = images[0]
  return {
    src: m.src,
    srcset: m.srcset,
    webp: m.webp,
    avif: m.avif,
    width: m.width,
    height: m.height,
    placeholder: m.placeholder.slice(0, 32) + '…',
    blurhash: m.blurhash,
    thumbhash: m.thumbhash,
    name: m.name,
  }
})

const metaJson = computed(() => JSON.stringify(meta.value, null, 2))
</script>

<template>
  <div>
    <p class="tab-title">Build-time imports — the seamless pipeline</p>
    <p class="tab-desc">
      The Vite plugin resolves query-suffixed imports, so you never wire props by hand — the
      metadata comes straight into your JS at build time. This unifies the CLI, the component and
      the plugin into a single workflow.
    </p>

    <div class="demo-grid">
      <div class="panel">
        <p class="panel-title">1 · Register the plugin</p>
        <div class="code-block">{{
`// vite.config.ts
import { vueImageKit } from 'vue-image-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueImageKit({ widths: [400, 800, 1200] }),
  ],
})`
        }}</div>

        <p class="panel-title" style="margin-top: 20px">2 · Import with a query suffix</p>
        <div class="code-block">{{
`import meta from './photo.jpg?vik'
// → { src, srcset, webp, avif, width,
//     height, placeholder, blurhash,
//     thumbhash, name, src400, … }

import hash from './photo.jpg?thumbhash'
// → 'base64string'`
        }}</div>

        <p class="panel-title" style="margin-top: 20px">3 · Spread onto VImage</p>
        <div class="code-block">{{
`<VImage
  :src="meta.src"
  :srcset="meta.srcset"
  :width="meta.width"
  :height="meta.height"
  :thumbhash="meta.thumbhash"
  alt="Hero"
/>`
        }}</div>
      </div>

      <div class="panel">
        <p class="panel-title">What <code style="color: #e3b341">?vik</code> returns</p>
        <p style="color: #8b949e; font-size: 0.8rem; margin-bottom: 12px; line-height: 1.6">
          The import resolves to a <code style="color: #e3b341">VikImageMeta</code> object —
          identical to a CLI manifest entry. Below is a real entry from this demo's manifest:
        </p>
        <div class="code-block meta-json">{{ metaJson }}</div>

        <p class="panel-title" style="margin-top: 20px">TypeScript</p>
        <div class="code-block">{{ '/// <reference types="vue-image-kit/vite/client" />' }}</div>
        <p style="color: #484f58; font-size: 0.72rem; margin-top: 12px; line-height: 1.6">
          <code style="color: #e3b341">?vik</code> resizes/encodes the image into the configured
          output (URLs use <code style="color: #e3b341">publicPath</code>, exactly like the
          manifest). <code style="color: #e3b341">?thumbhash</code> computes only the hash and writes
          nothing. Both re-run on change in dev.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meta-json {
  color: #79c0ff;
  max-height: 320px;
  overflow: auto;
  white-space: pre;
}
</style>
