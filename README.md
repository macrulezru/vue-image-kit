<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    vue-image-kit
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-image-kit.webp"
    alt="vue-image-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

A complete image optimization toolkit for Vue 3. One `<VImage>` component handles lazy loading, WebP/AVIF format switching, responsive art direction, Blurhash and LQIP placeholders, automatic `srcset` generation, error retry with exponential backoff, and smooth CSS transitions — with **zero external runtime dependencies** and a small, tree-shakeable footprint (see [Bundle size & peer dependencies](#bundle-size--peer-dependencies)).

Everything you need beyond the component is included: a **CLI** that processes images at build time (resize, convert, generate LQIP and BlurHash, write a TypeScript manifest), **CDN URL builders** for 12 providers (Cloudinary, imgix, Bunny, Sanity, Storyblok, Contentful, Vercel, Cloudflare, ImageKit, TwicPics, Netlify, Gumlet) with hostname auto-detection, a **Nuxt 3 module** with auto-imports, a **Vite plugin** (including on-demand dev serving), a **self-hosted on-demand image server** for when there's no CDN, and **headless composables** for fully custom markup.

Fully typed with TypeScript. Tree-shakeable (`sideEffects: false`). SSR-safe — renders a native `<img loading="lazy">` on the server, activates IntersectionObserver and canvas after hydration.

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start — Vue 3](#quick-start--vue-3)
- [Quick start — Nuxt 3](#quick-start--nuxt-3)
- [VImage](#vimage)
- [useImage](#useimage)
- [vLazyImg](#vlazyimg)
- [ThumbHash placeholder](#thumbhash-placeholder)
- [Blurhash placeholder](#blurhash-placeholder)
- [LQIP — base64 preview](#lqip--base64-preview)
- [srcset + sizes](#srcset--sizes)
- [WebP / AVIF source switching](#webp--avif-source-switching)
- [Responsive sources — art direction](#responsive-sources--art-direction)
- [Error state & fallback slot](#error-state--fallback-slot)
- [Lazy loading](#lazy-loading)
- [Vue plugin](#vue-plugin)
- [TypeScript types](#typescript-types)
- [SSR compatibility](#ssr-compatibility)
- [Architecture](#architecture)
- [CLI — generate images](#cli--generate-images)
- [Incremental generation](#incremental-generation)
- [CDN adapters](#cdn-adapters)
- [buildSizes helper](#buildsizes-helper)
- [generatePreloadLink](#generatepreloadlink)
- [useImagePreloader](#useimagepreloader)
- [fetchpriority & decoding](#fetchpriority--decoding)
- [Error retry](#error-retry)
- [Network-aware loading](#network-aware-loading)
- [Layout presets](#layout-presets)
- [Nuxt module](#nuxt-module)
- [Vite plugin](#vite-plugin)
- [Self-hosted on-demand server](#self-hosted-on-demand-server)
- [Demo](#demo)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)

---

## Features

**Placeholders**
- **Blurhash placeholder** — custom in-house decoder (no external packages); renders to `<canvas>` in `onMounted`; SSR renders a sized `<div>` preserving aspect-ratio
- **ThumbHash placeholder** — `thumbhash` prop on VImage auto-decodes to PNG data URL; supports alpha channel; better quality than BlurHash; `--thumbhash` flag in CLI generates hashes at build time
- **LQIP blur-up** — `data:image/…;base64,…` string as `placeholder`; blurred preview with `filter: blur()`; cross-fades via CSS `opacity` transition
- **Average-color placeholder** — `placeholderMode="color"` derives a solid background color from the ThumbHash header (0 bytes, no canvas); or set `placeholderColor` directly
- **Shimmer placeholder** — `placeholderMode="shimmer"` shows an animated CSS skeleton (no hash needed); respects `prefers-reduced-motion`
- **Client-side encoders** — `encodeThumbHash()` / `encodeBlurhash()` produce a hash from a `File`/`Canvas`/`ImageData` in the browser, for instant UGC previews; dependency-free

**Component — VImage**
- **srcset autogeneration** — pass `widths: [400, 800, 1200]`; `srcset` string built automatically; `sizes` prop passed through
- **Density descriptors** — `densities: [1, 2, 3]` (reuse `src`) or `{ 1: …, 2: … }` (distinct files per density) for `1x`/`2x`/`3x` srcset on fixed-size images
- **Focal point** — `focal: { x, y }` maps to `object-position` so the subject stays in frame when `fit="cover"` crops
- **WebP / AVIF switching** — `src` as `{ avif?, webp?, fallback }` renders `<picture>` with typed `<source>` elements
- **Responsive art direction** — named breakpoints map to `<source media="...">` elements; `max-width` and `min-width` queries sorted correctly
- **`fetchpriority` prop** — `high` for LCP images, `low` for below-the-fold; maps to the native HTML attribute
- **`decoding` prop** — `async` (default) / `sync` / `auto`; passed directly to `<img>`
- **Error retry** — `maxRetries` prop with exponential backoff; automatically retries failed loads without manual intervention
- **Error state** — `#error` slot for custom fallback UI; built-in default (grey rectangle + icon); `@error` event

**Loading**
- **IntersectionObserver lazy loading** — IO instead of `loading="lazy"` for precise control; configurable `rootMargin` and `threshold`; SSR-safe
- **IO pooling** — components sharing the same `rootMargin`+`threshold` config share one `IntersectionObserver` instance; no overhead at 50+ images
- **Background-image directive** — `v-lazy-img` sets `background-image` on any element after viewport entry; LQIP placeholder; configurable `transition`; `onLoad`/`onError` callbacks
- **`useBackgroundImage()`** — composable for lazy **+ responsive** (`image-set()`) backgrounds with blur-up; the `srcset` capability `v-lazy-img` lacks

**Composables & utilities**
- **`useImage()`** — headless state machine (`idle → loading → loaded | error`) + computed `imgAttrs`; works with any markup
- **`useImagePreloader()`** — preload a batch of URLs before navigation; `{ loaded, total, progress, isComplete, errors }`
- **`buildSizes()`** — build `sizes` attribute from breakpoint-keyed object; integrates with plugin breakpoints
- **`generatePreloadLink()`** — generates `<link rel="preload" as="image">` HTML for SSR/Nuxt `useHead`

**CDN adapters — `vue-image-kit/cdn`**
- Zero-dependency URL builders for **Cloudinary**, **imgix**, **Bunny CDN**, **Sanity**, **Storyblok**, **Contentful**, **Vercel**, **Cloudflare Images**, **ImageKit.io**, **TwicPics**, **Netlify Image CDN**, **Gumlet**
- Unified `.url(path, options)` / `.srcset(path, widths)` interface across all providers
- **`autoLoader()`** — detects 8 of the 12 providers straight from a URL's hostname, no per-image adapter wiring; unrecognized hosts pass through unchanged

**CLI — `npx vue-image-kit generate`**
- Resize images to multiple widths, convert to WebP/AVIF, generate LQIP base64, encode BlurHash
- Write a TypeScript manifest (`images.ts`) with all metadata pre-computed
- `--watch` mode, `--dry-run`, `--skip-existing`, `--concurrency`; config via `vue-image-kit.config.js`
- `sharp` as optional peer dependency — not included in the browser bundle

**Ecosystem**
- **Nuxt module** — `vue-image-kit/nuxt`; auto-registers `<VImage>` and `v-lazy-img`; auto-imports all composables and utilities; breakpoints via `runtimeConfig`
- **Vite plugin** — `vue-image-kit/vite`; runs the CLI processor on `buildStart`; re-runs in `handleHotUpdate` during dev; **build-time imports** via `?vik` / `?thumbhash` query suffixes
- **Vue plugin** — `app.use(VImageKitPlugin, { breakpoints })` registers component and directive globally
- **Zero external runtime dependencies** — only Vue 3 as peer dep; full ESM + CJS, tree-shakeable, `sideEffects: false` (see [Bundle size & peer dependencies](#bundle-size--peer-dependencies))

---

## Installation

```bash
npm install vue-image-kit
```

Peer dependency:

```bash
npm install vue@>=3.0
```

---

## Quick start — Vue 3

**1. Register the plugin**

```ts
// main.ts
import { createApp } from 'vue'
import { VImageKitPlugin } from 'vue-image-kit'
import App from './App.vue'

const app = createApp(App)
app.use(VImageKitPlugin)
app.mount('#app')
```

**2. Use the component**

```vue
<template>
  <VImage
    src="/photo.jpg"
    alt="Mountain landscape"
    :width="1200"
    :height="600"
    blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
  />
</template>
```

`<VImage>` is registered globally by the plugin. No import needed.

**3. Or import explicitly**

```vue
<script setup lang="ts">
import { VImage } from 'vue-image-kit'
</script>

<template>
  <VImage src="/photo.jpg" alt="My photo" />
</template>
```

---

## Quick start — Nuxt 3

**1. Add the module to `nuxt.config.ts`**

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-image-kit/nuxt'],
  vueImageKit: {
    breakpoints: {
      sm: '(max-width: 640px)',
      md: '(max-width: 1024px)',
    },
  },
})
```

**2. Use in pages and components — everything is auto-imported**

```vue
<template>
  <VImage
    :src="{ avif: '/hero.avif', webp: '/hero.webp', fallback: '/hero.jpg' }"
    alt="Hero image"
    :width="1920"
    :height="1080"
    :widths="[640, 1024, 1920]"
    sizes="100vw"
    blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
    :lazy="true"
  />
</template>
```

`<VImage>`, `v-lazy-img`, and all composables are registered automatically — no imports needed. Canvas and IntersectionObserver are activated only on the client — no hydration mismatch.

---

## VImage

The main component. Combines lazy loading, placeholder, format switching, and transitions in one element.

```vue
<VImage
  src="/photo.jpg"
  alt="Описание"
  :width="1200"
  :height="600"
  blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
  placeholder="data:image/jpeg;base64,..."
  :widths="[400, 800, 1200]"
  sizes="(max-width: 768px) 100vw, 50vw"
  :lazy="true"
  root-margin="300px"
  fit="cover"
  @load="onLoad"
  @error="onError"
>
  <template #error>
    <div class="my-error">Image failed to load</div>
  </template>
</VImage>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string \| SrcSet` | — | URL or object with format variants. Optional when `image` is given |
| `image` | `ImageMeta` | — | Build-time metadata (a CLI manifest entry or `?vik` import) — seeds `src`/`width`/`height`/`blurhash`/`thumbhash`/`placeholder`/`sizes`. Any explicit prop above overrides the matching field |
| `alt` | `string` | — | Required. `alt` attribute on the `<img>`. In dev builds, a suspicious value (missing, whitespace-only, or filename-shaped like `"photo.jpg"`) logs a `console.warn` — a deliberate `alt=""` for a decorative image never triggers it |
| `width` | `number` | — | Intrinsic width; used to reserve aspect-ratio space |
| `height` | `number` | — | Intrinsic height; used to reserve aspect-ratio space |
| `blurhash` | `string` | — | BlurHash string; decoded to canvas in `onMounted` |
| `thumbhash` | `string` | — | ThumbHash string; decoded to PNG data URL, used as blur-up placeholder |
| `placeholder` | `string` | — | Base64 LQIP or ThumbHash data URL; overrides `thumbhash` if both provided |
| `placeholderMode` | `'blur' \| 'color' \| 'shimmer'` | `'blur'` | `'color'` shows a solid average color (from `thumbhash`); `'shimmer'` shows an animated skeleton (no hash needed) |
| `placeholderColor` | `string` | — | Explicit solid CSS color placeholder; takes precedence and needs no decode |
| `widths` | `number[]` | — | Pixel widths for automatic width-based (`w`) `srcset` generation |
| `densities` | `number[] \| Record<number, string>` | — | Density descriptors (`1x`/`2x`/`3x`) for fixed-size images. List reuses `src`; map gives a distinct file per density. Takes precedence over `widths`, ignores `sizes` |
| `sizes` | `string` | — | `sizes` attribute passed to `<img>` (width-based srcset only) |
| `breakpoints` | `BreakpointMap` | — | Local breakpoints (merged with global plugin breakpoints) |
| `sources` | `ResponsiveSrc` | — | Breakpoint-key → URL (or `{ avif?, webp?, fallback }`) map for art direction, optionally combined with format switching per breakpoint |
| `lazy` | `boolean` | `true` | Enable IntersectionObserver lazy loading |
| `rootMargin` | `string` | `"200px"` | IO `rootMargin` — how far before the viewport loading starts |
| `threshold` | `number` | `0` | IO `threshold` — intersection ratio required to trigger |
| `fit` | `ObjectFit` | `"cover"` | CSS `object-fit` value on the `<img>` |
| `focal` | `FocalPoint` | — | Focal point `{ x, y }` (fractions 0–1) → `object-position`; keeps the subject in frame when `fit="cover"` crops |
| `maxRetries` | `number` | `0` | Max retry attempts on load failure |
| `retryDelay` | `number` | `1000` | Initial delay in ms; doubles each retry (exponential backoff) |
| `fetchpriority` | `'high' \| 'low' \| 'auto'` | — | Browser fetch priority hint |
| `decoding` | `'async' \| 'sync' \| 'auto'` | `'async'` | Image decoding mode |
| `priority` | `boolean` | `false` | Shorthand for the LCP/hero image — forces `lazy=false`, `fetchpriority='high'`, `decoding='sync'`. Not automatic LCP detection (that isn't reliable pre-paint); mark the one image that matters instead of setting three props by hand |
| `respectSaveData` | `boolean` | `false` | On a save-data connection: neutralizes `priority` (stays lazy) and downgrades `src` to the smallest URL available from `densities`/`image.srcset`. See "Network-aware loading" |
| `layout` | `'fixed' \| 'responsive' \| 'fill'` | — | Wrapper sizing preset. Unset keeps the current default (fills container width, aspect-ratio preserved). See "Layout presets" |
| `cdn` | `boolean \| AutoLoaderConfig` | — | Opt-in: routes a string `src` through `autoLoader()` — detects the CDN from the URL and rewrites it, no manual adapter wiring. See "CDN adapters → Auto CDN detection with VImage" |
| `loader` | `'server'` | — | Opt-in: routes a string `src` through the `vue-image-kit/server` on-demand handler via `buildImageUrl()`. See "Self-hosted on-demand server → Wiring VImage to it" |
| `loaderRoute` | `string` | `/_vik/image` | Route override for `loader="server"` — takes precedence over the plugin/Nuxt-module `serverRoute` default |

### Events

| Event | Payload | Description |
|---|---|---|
| `@load` | `Event` | Fired when the image finishes loading |
| `@error` | `Event` | Fired when the image fails to load |

### Slots

| Slot | Description |
|---|---|
| `#error` | Custom UI shown when the image fails to load. If omitted, a grey rectangle with a broken-image icon is shown. |

### Examples

**Simple image with lazy loading:**

```vue
<VImage src="/photo.jpg" alt="Landscape" />
```

**With blurhash and dimensions for aspect-ratio reservation:**

```vue
<VImage
  src="/photo.jpg"
  alt="Landscape"
  :width="1200"
  :height="800"
  blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
/>
```

**WebP/AVIF with srcset and blur-up:**

```vue
<VImage
  :src="{ avif: '/photo.avif', webp: '/photo.webp', fallback: '/photo.jpg' }"
  alt="Product"
  :width="800"
  :height="600"
  placeholder="data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
  :widths="[400, 800]"
  sizes="(max-width: 640px) 100vw, 800px"
/>
```

**Disable lazy loading for above-the-fold images:**

```vue
<VImage src="/hero.jpg" alt="Hero" :lazy="false" />
```

**LCP/hero image — `priority` instead of three separate props:**

```vue
<VImage src="/hero.jpg" alt="Hero" :width="1600" :height="900" priority />
```

**From CLI/manifest output — no manual prop wiring:**

```vue
<script setup lang="ts">
import meta from './photo.jpg?vik' // or: import { images } from './assets/images'
</script>

<template>
  <!-- src/width/height/blurhash/thumbhash/placeholder/sizes all come from meta -->
  <VImage :image="meta" alt="Product photo" />
</template>
```

**Focal point — keep the subject in frame when cropping:**

```vue
<!-- With fit="cover" the image is cropped to the box; focal decides which
     part survives. { x: 0.5, y: 0.3 } favours the upper-middle (e.g. a face). -->
<VImage
  src="/portrait.jpg"
  alt="Team member"
  :width="400"
  :height="400"
  fit="cover"
  :focal="{ x: 0.5, y: 0.3 }"
/>
```

**Cheapest placeholder — a solid average color (no canvas, 0 bytes):**

```vue
<!-- 'color' mode pulls the average RGBA straight from the ThumbHash header. -->
<VImage
  src="/photo.jpg"
  alt="Gallery item"
  :width="600"
  :height="400"
  thumbhash="3OcRJYB4d3h/iIeHeEh3eIhw+j5n"
  placeholder-mode="color"
/>

<!-- Or an explicit color you already know — needs no ThumbHash at all. -->
<VImage src="/photo.jpg" alt="Banner" placeholder-color="#1e3a8a" />
```

**Animated skeleton — when you have no hash at all:**

```vue
<!-- A CSS shimmer sweep until the image loads. Respects prefers-reduced-motion. -->
<VImage src="/photo.jpg" alt="Card" :width="400" :height="300" placeholder-mode="shimmer" />
```

**Custom error slot:**

```vue
<VImage src="/missing.jpg" alt="Missing">
  <template #error>
    <div class="placeholder">
      <span>📷</span>
      <p>Image unavailable</p>
    </div>
  </template>
</VImage>
```

**Handling events:**

```vue
<script setup lang="ts">
function onLoad(e: Event) {
  console.log('Image loaded', e)
}
function onError(e: Event) {
  console.warn('Image failed', e)
}
</script>

<template>
  <VImage
    src="/photo.jpg"
    alt="Photo"
    @load="onLoad"
    @error="onError"
  />
</template>
```

---

## useImage

Headless composable. Use it when you need the loading state machine and computed attributes but want to render your own markup.

```ts
const {
  status,      // Ref<'idle' | 'loading' | 'loaded' | 'error'>
  isLoaded,    // ComputedRef<boolean>
  isError,     // ComputedRef<boolean>
  imgAttrs,    // ComputedRef<ImgAttrs> — ready to spread onto <img>
  observe,     // (el: Ref<HTMLElement | null>) => void
  onImgLoad,   // () => void — call from img @load
  onImgError,  // () => void — call from img @error
} = useImage(options)
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `src` | `string \| SrcSet` | — | Image URL or format object |
| `widths` | `number[]` | `[]` | Widths for width-based (`w`) `srcset` generation |
| `densities` | `number[] \| Record<number, string>` | — | Density descriptors (`1x`/`2x`/`3x`); list reuses `src`, map gives distinct files; takes precedence over `widths`, ignores `sizes` |
| `sizes` | `string` | — | `sizes` attribute value (width-based srcset only) |
| `lazy` | `boolean` | `true` | Enable IntersectionObserver |
| `rootMargin` | `string` | `"200px"` | IO `rootMargin` |
| `threshold` | `number` | `0` | IO `threshold` |
| `fit` | `ObjectFit` | `"cover"` | `object-fit` style |
| `maxRetries` | `number` | `0` | Max retry attempts on load failure |
| `retryDelay` | `number` | `1000` | Initial delay in ms; doubles each retry |

### State machine

```
idle  →  loading  →  loaded
                  →  error
```

- When `lazy: true` — transitions to `loading` when the observed element enters the viewport
- When `lazy: false` — transitions to `loading` immediately after `onMounted`

### Return value

| Property | Type | Description |
|---|---|---|
| `status` | `Ref<ImageStatus>` | Current loading state |
| `isLoaded` | `ComputedRef<boolean>` | `true` when `status === 'loaded'` |
| `isError` | `ComputedRef<boolean>` | `true` when `status === 'error'` |
| `imgAttrs` | `ComputedRef<object>` | `{ src, srcset?, sizes?, style }` — ready for `v-bind` |
| `observe` | `Function` | Pass a `Ref<HTMLElement>` to start watching for intersection |
| `onImgLoad` | `Function` | Call from `<img @load>` to advance to `loaded` |
| `onImgError` | `Function` | Call from `<img @error>` to advance to `error` |

### Example — custom render

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useImage } from 'vue-image-kit'

const containerRef = ref<HTMLElement | null>(null)

const { status, isLoaded, imgAttrs, observe, onImgLoad, onImgError } = useImage({
  src: '/photo.jpg',
  widths: [400, 800, 1200],
  sizes: '(max-width: 768px) 100vw, 50vw',
})

onMounted(() => {
  observe(containerRef)
})
</script>

<template>
  <div ref="containerRef" class="image-wrapper">
    <div v-if="status === 'idle'" class="skeleton" />

    <img
      v-if="status === 'loading' || isLoaded"
      v-bind="imgAttrs"
      alt="Photo"
      :class="{ visible: isLoaded }"
      @load="onImgLoad"
      @error="onImgError"
    />

    <div v-if="status === 'error'" class="error-state">
      Failed to load
    </div>
  </div>
</template>

<style scoped>
img { opacity: 0; transition: opacity 0.3s; }
img.visible { opacity: 1; }
</style>
```

---

## vLazyImg

Directive for setting `background-image` on any element after it enters the viewport. Use it when you can't use the `<VImage>` component — CSS backgrounds, third-party wrappers, etc.

```vue
<!-- Simple string -->
<div v-lazy-img="'/background.jpg'" class="hero" />

<!-- Object with options -->
<div
  v-lazy-img="{
    src: '/background.jpg',
    placeholder: 'data:image/jpeg;base64,...',
    rootMargin: '100px',
    onLoad: () => console.log('loaded'),
    onError: (e) => console.error(e),
  }"
  class="hero"
/>
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | — | URL of the background image |
| `placeholder` | `string` | — | Base64 or URL shown immediately; replaced on load |
| `rootMargin` | `string` | `"200px"` | IO `rootMargin` |
| `threshold` | `number` | `0` | IO `threshold` |
| `onLoad` | `() => void` | — | Called when the image finishes loading |
| `onError` | `(e: Event) => void` | — | Called when the image fails to load |

### Behaviour

1. On mount — creates an `IntersectionObserver` and starts watching the element
2. When the element enters the viewport — if `placeholder` is set it is applied immediately as `background-image`
3. A new `Image` object loads `src` in the background
4. On load — `background-image` is updated to `src`; `onLoad` is called
5. On error — `onError` is called; `background-image` stays as the placeholder (if any)
6. On unmount — the observer is disconnected
7. On binding update — the observer is recreated with the new options

### Registering the directive manually

The directive is registered automatically with `VImageKitPlugin`. To register it in a single component:

```vue
<script setup lang="ts">
import { vLazyImg } from 'vue-image-kit'
</script>

<template>
  <div v-lazy-img="'/bg.jpg'" style="width:100%;height:400px" />
</template>
```

Or globally without the plugin:

```ts
import { vLazyImg } from 'vue-image-kit'

app.directive('lazy-img', vLazyImg)
```

### Example — card with lazy background

```vue
<script setup lang="ts">
import { vLazyImg } from 'vue-image-kit'

const cards = [
  { id: 1, bg: '/card-1.jpg', placeholder: 'data:image/jpeg;base64,/9j/...' },
  { id: 2, bg: '/card-2.jpg', placeholder: 'data:image/jpeg;base64,/9j/...' },
]
</script>

<template>
  <div
    v-for="card in cards"
    :key="card.id"
    v-lazy-img="{ src: card.bg, placeholder: card.placeholder }"
    class="card"
  />
</template>

<style scoped>
.card {
  width: 300px;
  height: 200px;
  background-size: cover;
  background-position: center;
  border-radius: 12px;
}
</style>
```

---

## useBackgroundImage

The `v-lazy-img` directive lazy-loads a background but can't do `srcset`. `useBackgroundImage` is the composable counterpart: **lazy loading + responsive `image-set()`** (the CSS-native equivalent of `srcset`) + blur-up — returned as a reactive `:style` you bind yourself.

```vue
<script setup lang="ts">
import { useBackgroundImage } from 'vue-image-kit'

const { target, style, isLoaded } = useBackgroundImage('/hero.jpg', {
  placeholder: 'data:image/jpeg;base64,/9j/...',
  densities: [1, 2],          // → image-set(url("/hero.jpg") 1x, url("/hero.jpg") 2x)
  rootMargin: '300px',
})
</script>

<template>
  <section ref="target" :style="style" class="hero">
    <h1 v-show="isLoaded">Welcome</h1>
  </section>
</template>

<style scoped>
.hero { width: 100%; height: 60vh; }
</style>
```

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | — | URL/data URL shown (blurred) until the full image loads |
| `densities` | `number[]` | — | Builds a responsive `image-set()` with `1x`/`2x`/… entries |
| `type` | `string` | — | MIME hint for `image-set()` entries (e.g. `'image/webp'`) |
| `lazy` | `boolean` | `true` | Gate loading behind IntersectionObserver |
| `rootMargin` | `string` | `'200px'` | IO root margin |
| `threshold` | `number` | `0` | IO threshold |
| `transition` | `string` | `'0.4s ease'` | Blur-up transition |
| `backgroundSize` | `string` | `'cover'` | `background-size` |
| `backgroundPosition` | `string` | `'center'` | `background-position` |

**Returns** `{ target, style, status, isLoaded, isLoading, load }`. Attach `target` via a template ref and bind `style`; call `load()` to trigger manually when `lazy: false`. SSR-safe (loading is deferred to the client).

---

## ThumbHash placeholder

ThumbHash is a modern alternative to BlurHash with **alpha channel support**, better visual quality on photos, and a shorter hash string. It decodes to a PNG data URL.

**`thumbhash` prop — the simplest way:**

```vue
<VImage
  src="/photo.png"
  alt="Photo with transparency"
  thumbhash="3OcRJYB4d3h/iIeHeEh3eIhw+j5n"
/>
```

VImage decodes the hash automatically and uses it as a blur-up placeholder. No manual decoding needed.

**Using the decoder directly** (for custom markup or `v-lazy-img`):

```ts
import { decodeThumbHash } from 'vue-image-kit'

const dataUrl = decodeThumbHash('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')
// → 'data:image/png;base64,...'
```

**Average color — the cheapest placeholder of all** (decoded from the header, no pixels):

```ts
import { thumbHashToAverageRGBA, thumbHashToAverageColor } from 'vue-image-kit'

thumbHashToAverageRGBA('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')
// → { r, g, b, a }  (each channel 0–1)

thumbHashToAverageColor('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')
// → 'rgba(150, 146, 104, 1.000)'  — drop straight into background-color
```

Or let VImage do it via `placeholder-mode="color"` (see [Props](#props)).

**`placeholder` prop** — equivalent when you already have the data URL:

```vue
<VImage
  src="/photo.png"
  alt="Photo"
  :placeholder="decodeThumbHash('3OcRJYB4d3h/iIeHeEh3eIhw+j5n')"
/>
```

If both `thumbhash` and `placeholder` are provided, `placeholder` takes priority.

**Generating ThumbHash hashes at build time:**

Use the CLI with `--thumbhash` flag (requires `thumbhash` as a dev dependency):

```bash
npm install thumbhash --save-dev

npx vue-image-kit generate \
  --input ./src/images \
  --manifest ./src/assets/images.ts \
  --thumbhash
```

The manifest will include a `thumbhash` field for each image alongside `blurhash` and `placeholder`.

Or generate manually in Node.js:

```ts
import { rgbaToThumbHash } from 'thumbhash'
import sharp from 'sharp'

const { data, info } = await sharp('photo.jpg')
  .resize(100, 100, { fit: 'inside' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const hash = rgbaToThumbHash(info.width, info.height, new Uint8Array(data.buffer))
const hashBase64 = Buffer.from(hash).toString('base64')
// Store in DB / manifest, pass as thumbhash prop
```

---

## Blurhash placeholder

`<VImage>` decodes the blurhash string internally — no external package needed. The decoder is implemented from scratch following the [open blurhash specification](https://github.com/woltapp/blurhash/blob/master/Algorithm.md).

Pass `blurhash` together with `width` and `height` to enable the canvas placeholder:

```vue
<VImage
  src="/photo.jpg"
  alt="Landscape"
  :width="1200"
  :height="800"
  blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj"
/>
```

**How it works:**

1. On the server — a blank `<div>` with `aspect-ratio: 1200/800` is rendered to reserve space
2. On mount — `decodeBlurhash(hash, width, height)` is called and the pixel data is drawn to `<canvas>` via `ImageData`
3. The canvas stays visible while the image loads; it fades out via opacity transition when the image is ready

**Using the decoder directly:**

```ts
import { decodeBlurhash } from 'vue-image-kit'

const pixels = decodeBlurhash('LEHV6nWB2yk8pyo0adR*.7kCMdnj', 32, 32)
// pixels: Uint8ClampedArray<ArrayBuffer> — RGBA, row-major

const canvas = document.createElement('canvas')
canvas.width = 32
canvas.height = 32
canvas.getContext('2d')!.putImageData(new ImageData(pixels, 32, 32), 0, 0)
```

**Generating blurhash strings:**

The decoder is included — you still need to generate hashes on the server/build step. Use the official [blurhash](https://github.com/woltapp/blurhash) package at build time, or any server-side tool. Pass the resulting string to `<VImage>` as the `blurhash` prop.

---

## LQIP — base64 preview

LQIP (Low Quality Image Placeholder) shows a tiny blurred version of the image while the full resolution loads.

```vue
<VImage
  src="/photo.jpg"
  alt="Photo"
  placeholder="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
/>
```

**How it works:**

- The base64 image is rendered as a separate `<img>` with `filter: blur(20px)` and `transform: scale(1.05)` (to hide blurred edges)
- When the full image loads, both fade with an `opacity` transition — the placeholder fades out, the full image fades in
- The placeholder is `aria-hidden="true"` — invisible to screen readers

**Generating LQIP at build time (Node.js example):**

```ts
import sharp from 'sharp'

const buffer = await sharp('photo.jpg')
  .resize(20)
  .jpeg({ quality: 20 })
  .toBuffer()

const lqip = `data:image/jpeg;base64,${buffer.toString('base64')}`
// Pass this string as the placeholder prop
```

---

## Client-side encoding (user-generated content)

When a user uploads a photo, encode a placeholder **in the browser** so you can show a blur-up preview instantly — before the full image is uploaded or processed. Both encoders are dependency-free (the ThumbHash encoder is a faithful port of the reference, byte-identical to the `thumbhash` package) and accept a `File`/`Blob`, `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap`, or `ImageData`.

```ts
import { encodeThumbHash, encodeBlurhash, decodeThumbHash } from 'vue-image-kit'

async function onFileSelected(file: File) {
  const thumbhash = await encodeThumbHash(file)
  // → base64 string; feed straight into <VImage :thumbhash="thumbhash">
  //   or decodeThumbHash(thumbhash) for a data URL preview.

  const blurhash = await encodeBlurhash(file, { componentX: 4, componentY: 3 })
}
```

| Function | Returns | Options |
|---|---|---|
| `encodeThumbHash(source, options?)` | `Promise<string>` (base64) | `maxSize` (default/max `100`) |
| `encodeBlurhash(source, options?)` | `Promise<string>` | `componentX` (1–9, default `4`), `componentY` (1–9, default `3`), `maxSize` (default `64`) |

The source is downscaled to `maxSize` on its longest edge before encoding (a ThumbHash must fit within 100×100). These require a browser/DOM — they throw in SSR.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { encodeThumbHash } from 'vue-image-kit'

const hash = ref('')
async function handleUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) hash.value = await encodeThumbHash(file)
}
</script>

<template>
  <input type="file" accept="image/*" @change="handleUpload" />
  <VImage v-if="hash" :src="previewUrl" alt="Preview" :thumbhash="hash" />
</template>
```

---

## srcset + sizes

Pass `widths` to auto-generate the `srcset` attribute:

```vue
<VImage
  src="/photo.jpg"
  alt="Photo"
  :widths="[400, 800, 1200]"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

Renders:

```html
<img
  src="/photo.jpg"
  srcset="/photo.jpg 400w, /photo.jpg 800w, /photo.jpg 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Photo"
/>
```

When `widths` is not provided, `srcset` is not added — the plain `src` is used.
When `widths` is provided but `sizes` is not, `sizes` defaults to `"100vw"`.

### Density descriptors (`1x` / `2x` / `3x`)

For fixed-size images — icons, avatars, logos — use `densities` instead of `widths`. The browser picks the candidate matching the device pixel ratio; no `sizes` is needed. `densities` takes precedence over `widths` (the two descriptor types can't be mixed in one `srcset`).

`:densities` accepts two forms:

```vue
<!-- 1. Per-density URL map — distinct files (recommended for static assets). -->
<VImage
  src="/avatar.png"
  alt="Avatar"
  :width="48"
  :height="48"
  :densities="{ 1: '/avatar.png', 2: '/avatar@2x.png', 3: '/avatar@3x.png' }"
/>
<!-- → srcset="/avatar.png 1x, /avatar@2x.png 2x, /avatar@3x.png 3x" -->

<!-- 2. Density list — reuses the single `src` for every density. Only useful
     when the URL itself is resolution-aware (a CDN/DPR endpoint). -->
<VImage src="https://cdn.example.com/avatar?dpr=auto" alt="Avatar" :densities="[1, 2, 3]" />
<!-- → srcset="…?dpr=auto 1x, …?dpr=auto 2x, …?dpr=auto 3x" -->
```

**Using the utilities directly:**

```ts
import { generateSrcset, generateSizes, generateDensitySrcset } from 'vue-image-kit'

generateSrcset('/photo.jpg', [400, 800, 1200])
// → '/photo.jpg 400w, /photo.jpg 800w, /photo.jpg 1200w'

generateSizes('(max-width: 768px) 100vw, 50vw')
// → '(max-width: 768px) 100vw, 50vw'

generateSizes()
// → '100vw'

generateDensitySrcset('/logo.png', [1, 2, 3])
// → '/logo.png 1x, /logo.png 2x, /logo.png 3x'

// Distinct files per density via a URL map:
generateDensitySrcset({ 1: '/a.png', 2: '/a@2x.png' }, [1, 2])
// → '/a.png 1x, /a@2x.png 2x'
```

---

## WebP / AVIF source switching

When `src` is an object instead of a string, `<VImage>` renders a `<picture>` element with the appropriate `<source>` elements:

```vue
<VImage
  :src="{
    avif: '/photo.avif',
    webp: '/photo.webp',
    fallback: '/photo.jpg',
  }"
  alt="Photo"
  :width="1200"
  :height="800"
/>
```

Renders:

```html
<picture>
  <source srcset="/photo.avif" type="image/avif" />
  <source srcset="/photo.webp" type="image/webp" />
  <img src="/photo.jpg" alt="Photo" width="1200" height="800" />
</picture>
```

The browser picks the first format it supports. If only `webp` is provided, only one `<source>` is added. `fallback` is always required.

### SrcSet object

```ts
interface SrcSet {
  avif?: string    // URL of the AVIF version
  webp?: string    // URL of the WebP version
  fallback: string // Required — the original format (JPEG/PNG)
}
```

---

## Responsive sources — art direction

Use this when you need to serve a **fundamentally different image** (different crop, different composition) based on screen size. Implemented via named breakpoints — the browser picks the first matching `<source media="...">`.

### Global breakpoints (set once when installing the plugin)

```ts
// main.ts
app.use(VImageKitPlugin, {
  breakpoints: {
    sm:  '(max-width: 640px)',
    md:  '(max-width: 1024px)',
    lg:  '(min-width: 1025px)',
  },
})
```

### Using in components — keys only

```vue
<VImage
  src="/hero-desktop.jpg"
  alt="Hero"
  :sources="{
    sm: '/hero-mobile.jpg',
    md: '/hero-tablet.jpg',
  }"
/>
```

Generates:

```html
<picture>
  <source media="(max-width: 640px)"  srcset="/hero-mobile.jpg" />
  <source media="(max-width: 1024px)" srcset="/hero-tablet.jpg" />
  <img src="/hero-desktop.jpg" alt="Hero" />
</picture>
```

`<source>` order is set **automatically** in ascending `max-width` order — required by `<picture>`, which picks the first matching source.

### Per-component breakpoints

Merged with global breakpoints. Local keys take priority on conflict:

```vue
<VImage
  src="/product-desktop.jpg"
  alt="Product"
  :breakpoints="{
    xs:   '(max-width: 375px)',
    wide: '(min-width: 1600px)',
  }"
  :sources="{
    xs:   '/product-xs.jpg',
    sm:   '/product-mobile.jpg',
    md:   '/product-tablet.jpg',
    wide: '/product-wide.jpg',
  }"
/>
```

The resulting `<picture>` contains `<source>` elements for `xs`, `sm`, `md` (from merged breakpoints), and `wide` — sorted automatically.

### Combining with AVIF/WebP

Responsive sources (`sources`) and format sources (`src` as object) are independent and rendered together:

```vue
<VImage
  :src="{ avif: '/hero.avif', webp: '/hero.webp', fallback: '/hero.jpg' }"
  :sources="{ sm: '/hero-mobile.jpg' }"
  alt="Hero"
/>
```

```html
<picture>
  <source media="(max-width: 640px)" srcset="/hero-mobile.jpg" />
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero" />
</picture>
```

That covers "one crop set + one format set, independent of each other." For a
**different crop *and* different formats per breakpoint** — e.g. a portrait
AVIF/WebP crop on mobile, a landscape AVIF/WebP crop on desktop — a breakpoint's
value in `sources` can itself be a `{ avif?, webp?, fallback }` object instead
of a plain URL:

```vue
<VImage
  alt="Hero"
  :sources="{
    sm: { avif: '/hero-mobile.avif', webp: '/hero-mobile.webp', fallback: '/hero-mobile.jpg' },
    md: { webp: '/hero-tablet.webp', fallback: '/hero-tablet.jpg' },
  }"
  src="/hero-desktop.jpg"
/>
```

```html
<picture>
  <source media="(max-width: 640px)"  srcset="/hero-mobile.avif" type="image/avif" />
  <source media="(max-width: 640px)"  srcset="/hero-mobile.webp" type="image/webp" />
  <source media="(max-width: 640px)"  srcset="/hero-mobile.jpg" />
  <source media="(max-width: 1024px)" srcset="/hero-tablet.webp" type="image/webp" />
  <source media="(max-width: 1024px)" srcset="/hero-tablet.jpg" />
  <img src="/hero-desktop.jpg" alt="Hero" />
</picture>
```

Plain-URL and format-object breakpoints can be mixed freely in the same
`sources` object. `avif`/`webp` are both optional per breakpoint — only the
formats you actually have are emitted.

### BreakpointMap

```ts
type BreakpointMap = Record<string, string>
// key — arbitrary name, value — CSS media query
```

### Breakpoint priority

| Source | Priority |
|---|---|
| Local `breakpoints` prop on the component | High — overrides global keys on conflict |
| Global `breakpoints` from `VImageKitPlugin` | Base — available in all components |

---

## Error state & fallback slot

**Default fallback** — if no `#error` slot is provided, a grey rectangle with a broken-image SVG icon is shown:

```vue
<VImage src="/missing.jpg" alt="Missing" :width="400" :height="300" />
<!-- Shows: grey rectangle + SVG icon -->
```

**Custom fallback via slot:**

```vue
<VImage src="/missing.jpg" alt="Missing" :width="400" :height="300">
  <template #error>
    <div class="error-placeholder">
      <img src="/no-image.svg" alt="" />
      <p>Image is currently unavailable</p>
    </div>
  </template>
</VImage>
```

**Handling errors in JavaScript:**

```vue
<script setup lang="ts">
function handleError(e: Event) {
  console.error('Image failed to load:', e)
  // Report to Sentry, switch to a fallback URL, etc.
}
</script>

<template>
  <VImage src="/photo.jpg" alt="Photo" @error="handleError" />
</template>
```

---

## Lazy loading

`<VImage>` uses `IntersectionObserver` for lazy loading — not the native `loading="lazy"` attribute — for full control over when loading starts.

```vue
<!-- Default: loads when the image is 200px from the viewport -->
<VImage src="/photo.jpg" alt="Photo" />

<!-- Custom rootMargin — start loading 500px before the viewport -->
<VImage src="/photo.jpg" alt="Photo" root-margin="500px" />

<!-- Load when 50% of the image is visible -->
<VImage src="/photo.jpg" alt="Photo" :threshold="0.5" />

<!-- Disable lazy loading — load immediately (above the fold) -->
<VImage src="/photo.jpg" alt="Photo" :lazy="false" />
```

### How it works

1. On mount — an `IntersectionObserver` is created and begins watching the wrapper element
2. When the element enters the viewport (accounting for `rootMargin`) — the image `src` is set and loading begins (`status: 'loading'`)
3. When the image loads — `status` transitions to `'loaded'`; the placeholder fades out
4. The observer disconnects after the first intersection — no unnecessary callbacks

### SSR behaviour

On the server, `IntersectionObserver` is unavailable. `<VImage>` renders a plain `<img loading="lazy">` without any JavaScript-driven state. After hydration, `onMounted` sets up the IO as normal.

---

## Vue plugin

Register `<VImage>` and `v-lazy-img` globally with a single `app.use()` call:

```ts
import { createApp } from 'vue'
import { VImageKitPlugin } from 'vue-image-kit'
import App from './App.vue'

const app = createApp(App)
app.use(VImageKitPlugin)
app.mount('#app')
```

After installation:

- `<VImage>` is available in all templates without importing
- `v-lazy-img` directive is registered and available in all templates

**Import the plugin and individual exports separately if needed:**

```ts
import {
  VImageKitPlugin,  // Vue plugin
  VImage,           // component
  vLazyImg,         // directive
  useImage,         // composable
  useBlurhash,      // canvas composable
  useLazyLoad,      // IO composable
  decodeBlurhash,   // standalone decoder
  generateSrcset,   // srcset utility
  generateSizes,    // sizes utility
} from 'vue-image-kit'
```

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  ImageStatus,      // 'idle' | 'loading' | 'loaded' | 'error'
  SrcSet,           // { avif?: string; webp?: string; fallback: string }
  ResponsiveSrc,    // Record<string, string | SrcSet> — breakpoint-key → URL, or a format set for that breakpoint
  BreakpointMap,    // Record<string, string> — breakpoint-key → CSS media query
  VImageKitOptions, // { breakpoints?: BreakpointMap }
  LazyImgOptions,   // { src, placeholder?, rootMargin?, threshold?, onLoad?, onError? }
  ObjectFit,        // 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  FocalPoint,       // { x: number; y: number } — fractions 0–1
  Densities,        // number[] | Record<number, string> — density descriptors
  ImageMeta,        // CLI manifest entry / `?vik` import shape, for the `image` prop
  Layout,           // 'fixed' | 'responsive' | 'fill' — the `layout` prop
} from 'vue-image-kit'
```

### `ImageStatus`

```ts
type ImageStatus = 'idle' | 'loading' | 'loaded' | 'error'
```

The state machine transitions in order: `idle → loading → loaded` or `idle → loading → error`.

### `SrcSet`

```ts
interface SrcSet {
  avif?: string     // Optional AVIF source URL
  webp?: string     // Optional WebP source URL
  fallback: string  // Required — used as the <img src> fallback
}
```

### `LazyImgOptions`

```ts
interface LazyImgOptions {
  src: string
  placeholder?: string
  rootMargin?: string
  threshold?: number
  onLoad?: () => void
  onError?: (e: Event) => void
}
```

The `v-lazy-img` directive accepts either a plain `string` (the `src`) or a `LazyImgOptions` object.

### Working with typed options in v-lazy-img

```ts
import type { LazyImgOptions } from 'vue-image-kit'

const bgOptions: LazyImgOptions = {
  src: '/hero.jpg',
  placeholder: 'data:image/jpeg;base64,...',
  rootMargin: '100px',
  onLoad: () => analytics.track('hero_loaded'),
}
```

```vue
<div v-lazy-img="bgOptions" class="hero" />
```

---

## SSR compatibility

| Scenario | Behaviour |
|---|---|
| Server render — `<VImage>` | Renders `<img loading="lazy">` with `src` and `alt`; no IO, no canvas |
| Server render — aspect-ratio | A `<div>` with `aspect-ratio: width/height` is rendered when `width` and `height` are provided |
| Blurhash on server | Canvas code is inside `onMounted` — not executed; a blank container is rendered instead |
| `IntersectionObserver` on server | Not used; the server renders a plain `<img>` |
| Hydration | After mount, `onMounted` sets up IO (if `lazy: true`) or immediately starts loading (if `lazy: false`) |
| `v-lazy-img` on server | Directive hooks (`mounted`, `unmounted`) are not called during SSR — no IO is created |
| `useLazyLoad` on server | Returns `{ isIntersecting: true }` immediately — the caller proceeds as if in-viewport |

**Nuxt usage:**

No special configuration is required. The component renders correctly in both SSR and client modes. If you need to know whether the client has mounted, use Vue's `onMounted`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const mounted = ref(false)
onMounted(() => { mounted.value = true })
</script>

<template>
  <VImage v-if="mounted" src="/photo.jpg" alt="Photo" blurhash="..." />
  <div v-else style="aspect-ratio: 16/9; background: #e5e7eb;" />
</template>
```

---

## Architecture

```
VImage.vue
│  props: src, alt, width, height,
│         blurhash, thumbhash, placeholder,
│         widths, sizes, sources, breakpoints,
│         lazy, rootMargin, threshold, fit,
│         maxRetries, retryDelay,
│         fetchpriority, decoding
│
├──▶ useImage(options)
│         │
│         ├── useLazyLoad({ rootMargin, threshold })
│         │      IntersectionObserver (SSR-safe)
│         │      isIntersecting: Ref<boolean>
│         │      observe(elRef) → starts watching
│         │
│         ├── State machine
│         │      idle → loading → loaded
│         │                    → error (retryCount >= maxRetries)
│         │                    → idle → loading  (retry, exponential backoff)
│         │      lazy=true  → watch(isIntersecting) → loading
│         │      lazy=false → onMounted → loading
│         │
│         └── imgAttrs: ComputedRef
│                src    = fallback URL
│                srcset = generateSrcset(src, widths)
│                sizes  = generateSizes(sizes)
│                style  = { objectFit: fit }
│
├──▶ useBlurhash({ blurhash, width, height })
│         onMounted → decodeBlurhash(hash, width, height)
│                   → new ImageData(pixels, width, height)
│                   → ctx.putImageData(imageData, 0, 0)
│         canvasRef: Ref<HTMLCanvasElement | null>
│         SSR: returns null ref (canvas code never runs)
│
├──▶ useBreakpoints(breakpoints?)
│         Merges local breakpoints prop with global plugin breakpoints
│         resolveMediaSources(sources) → sorted [{ media, src }]
│
├──▶ effectivePlaceholder: ComputedRef<string | undefined>
│         placeholder prop  → used as-is (LQIP base64)
│         thumbhash prop    → decodeThumbHash(hash) → PNG data URL
│         neither           → undefined (no blur-up placeholder)
│
├──▶ Template structure (client)
│      <span wrapper :style="{ aspectRatio, position: relative }">
│        <canvas v-if="blurhash && width && height && !isError" />
│                                              ← BlurHash canvas placeholder
│        <img aria-hidden
│             v-if="effectivePlaceholder && !isError" />
│                                              ← LQIP / ThumbHash blur-up
│        <span v-if="isError">                ← error state
│          <slot name="error"><svg .../></slot>
│        </span>
│        <picture v-if="shouldRenderImg && !isError && needsPicture">
│                                              ← format/art-direction sources
│          <source v-for media/srcset />       ← responsive art direction
│          <source type="image/avif" />
│          <source type="image/webp" />
│          <img v-bind="imgAttrs" :decoding :fetchpriority @load @error />
│        </picture>
│        <img v-if="shouldRenderImg && !isError && !needsPicture"
│             v-bind="imgAttrs" :decoding :fetchpriority @load @error />
│                                              ← simple img (no picture)
│        <span v-if="isIdle && !blurhash && !effectivePlaceholder" />
│                                              ← grey background (no placeholder)
│      </span>
│
└──▶ Template structure (SSR)
       <img :src :alt :width :height :decoding :fetchpriority
            :loading="lazy ? 'lazy' : 'eager'" />

vLazyImg (Directive)
│  mounted(el, binding)
│    resolveOptions(binding) → { src, placeholder, rootMargin, ... }
│    createObserver(el, options)
│      IntersectionObserver → on intersect:
│        if placeholder: el.style.backgroundImage = url(placeholder)
│        new Image()
│          onload  → el.style.backgroundImage = url(src); onLoad()
│          onerror → onError(e)
│  updated  → disconnect old observer, create new one
│  unmounted → observer.disconnect()

Utils (pure functions, zero Vue deps)
│  blurhash-decode.ts
│    decodeBlurhash(hash, width, height) → Uint8ClampedArray  ← RGBA pixels
│
│  thumbhash-decode.ts
│    decodeThumbHash(hash: string | Uint8Array) → string      ← PNG data URL
│
└── srcset.ts
    generateSrcset(src, widths) → string
    generateSizes(sizes?) → string
    buildSizes(map, breakpoints) → string
    generatePreloadLink(href, options) → string
```

---


## CLI — generate images

Resize images, convert to WebP/AVIF, generate LQIP and BlurHash, write a TypeScript manifest — all in one command.

Requires `sharp` as a dev dependency:

```bash
npm install sharp --save-dev
```

**Basic usage:**

```bash
npx vue-image-kit generate \
  --input ./src/images \
  --output ./public/images \
  --widths 400,800,1200 \
  --formats jpg,webp,avif \
  --manifest ./src/assets/images.ts
```

Prints a per-image report as it works — source path/format/dimensions/size,
then every output variant with its own path/format/dimensions/size (`(existing)`
for a file `--skip-existing` kept, `(dry-run — not written)` under `--dry-run`)
— followed by a batch total: images/files processed, total input vs. output
size, and how much the *smallest available format* saves vs. the original on
average (deliberately not "total output vs. total input" — with several
widths × formats generated per image, total output is naturally many times
one original's size, which would misleadingly read as "this made it worse"):

```
[vue-image-kit] Processing 1 image(s)…
[vue-image-kit] photo1
  Input   ./src/images/photo1.jpg
          jpg · 1200×800 · 245.3 KB
  Output
    ./public/images/photo1-400.jpg   jpg   400×267   52.1 KB
    ./public/images/photo1-800.jpg   jpg   800×533  118.4 KB
    ./public/images/photo1.jpg       jpg  1200×800  198.2 KB
    ./public/images/photo1.webp      webp 1200×800  112.9 KB
    ./public/images/photo1.avif      avif 1200×800   79.6 KB
[vue-image-kit] Done. 1 image(s) → 5 file(s).
  Input:  1 image(s), 245.3 KB total
  Output: 5 file(s), 561.2 KB total
  Smallest available format saves ~79% vs. original, on average
[vue-image-kit] Manifest written to ./src/assets/images.ts
```

**All options:**

| Flag | Default | Description |
|---|---|---|
| `--input <dir>` | `./src/images` | Source directory |
| `--output <dir>` | `./public/images` | Output directory |
| `--widths <list>` | `400,800,1200` | Comma-separated output widths |
| `--formats <list>` | `jpg,webp,avif` | Output formats |
| `--quality <json>` | `{"jpg":85,"webp":80,"avif":65}` | Quality per format |
| `--template <str>` | `{name}-{width}.{ext}` | Filename template (`{name}`, `{width}`, `{ext}`) |
| `--manifest <path>` | — | Write `images.ts` manifest to this path |
| `--public-path <str>` | `/images` | URL prefix used in manifest paths |
| `--lqip` / `--no-lqip` | enabled | Generate base64 LQIP placeholder |
| `--blurhash` / `--no-blurhash` | enabled | Generate BlurHash string |
| `--thumbhash` / `--no-thumbhash` | disabled | Generate ThumbHash string (requires `thumbhash` dev dep) |
| `--clean` | — | Remove output dir before generating |
| `--dry-run` | — | Preview without writing files |
| `--skip-existing` | — | Skip already-generated files |
| `--concurrency <n>` | `4` | Parallel workers |
| `--watch` | — | Watch input dir and regenerate on change |
| `--incremental` / `--no-incremental` | auto | Skip reprocessing a source whose mtime (or, if that changed, content hash) matches the last run. Auto-enabled under `--watch` (and by the Vite plugin during `vite dev`) unless set explicitly either way — a one-shot `generate` stays off by default. See "Incremental generation" below |

**Config file** — create `vue-image-kit.config.js` in your project root to avoid repeating flags:

```js
// vue-image-kit.config.js
export default {
  input: './photos',
  output: './public/images',
  widths: [480, 960, 1440],
  formats: ['jpg', 'webp'],
  manifest: './src/assets/images.ts',
  publicPath: '/images',
}
```

**SVG and animated GIF** are handled differently from raster formats — they're detected by input extension, not by `--formats`:

- **SVG** is copied through untouched (no rasterizing — it's already resolution-independent). The manifest entry gets `src` pointing at the copy; `webp`/`avif`/`placeholder`/`blurhash`/`thumbhash` are empty strings.
- **Animated GIF** is copied through as the guaranteed-compatible fallback (`src`), and — when `webp` is in `--formats` — re-encoded to animated WebP (`webp` field) for a real size win. AVIF is skipped: animated-AVIF support across `sharp`/libavif builds is too inconsistent to promise. LQIP/BlurHash/ThumbHash placeholders are still generated from the first frame.

### Incremental generation

`--watch` and the Vite plugin's `buildStart`/`handleHotUpdate` both call the
same `generate()` the CLI does — by default, every single-file change means
re-scanning and reprocessing **every** source image, not just the one that
changed. `incremental` mode fixes that:

```bash
npx vue-image-kit generate --watch --incremental   # already the default under --watch
```

For each source, it checks a persisted record from the previous run:
mtime unchanged → skip entirely, no read, no `sharp` call. Mtime changed
(e.g. a git checkout touched every file) → falls back to a content hash
before deciding — an unmodified file survives a checkout without triggering
a needless reprocess. The record — a JSON manifest at
`<output>/.vik-incremental.json` — also stores each skipped image's full
metadata, so the batch report/`--manifest` output stays complete even for
images that weren't touched this run.

Changing `widths`/`formats`/`quality`/`template`/`publicPath`/`lqip`/
`blurhash`/`thumbhash` between runs invalidates **everything** at once
(logged as `Config changed since last run`) — not per-file diffing, since a
config change can affect any or all outputs. `--clean` also invalidates
everything, naturally: it deletes `output`, and the manifest lives inside
it. No effect under `--dry-run` (nothing is written, so there's nothing
valid to compare against next time).

**Defaults**: off for a one-shot `generate` (a single run gains nothing from
caching), on automatically under `--watch` and during `vite dev` (`vite
build` stays off — a production artifact shouldn't risk a stale cache).
An explicit `--incremental`/`--no-incremental` (CLI flag, config file, or
Vite plugin option) always overrides the automatic default either way.

---

## CDN adapters

`vue-image-kit/cdn` provides URL builders for popular image CDNs — no dependencies, pure functions.

```ts
import {
  cloudinary, imgix, bunny, sanity, storyblok, contentful, vercel,
  cloudflare, imagekit, twicpics, netlify, gumlet,
} from 'vue-image-kit/cdn'
```

All adapters share the same interface:

```ts
adapter.url(path, options?)     // → single URL string
adapter.srcset(path, widths, options?)  // → ready srcset string
```

**Cloudinary:**

```ts
const cdn = cloudinary({ cloudName: 'my-cloud' })

cdn.url('photo.jpg', { width: 800, format: 'webp' })
// → https://res.cloudinary.com/my-cloud/w_800,q_auto,f_webp/image/upload/photo.jpg

cdn.srcset('photo.jpg', [400, 800, 1200])
// → 'https://res.cloudinary.com/my-cloud/w_400,... 400w, ...'
```

**imgix:**

```ts
const cdn = imgix('https://mysite.imgix.net')

cdn.url('photo.jpg', { width: 800, dpr: 2 })
// → https://mysite.imgix.net/photo.jpg?w=800&dpr=2&auto=format

cdn.srcset('photo.jpg', [400, 800, 1200])
```

**Bunny CDN:**

```ts
const cdn = bunny('https://myzone.b-cdn.net')
cdn.url('photo.jpg', { width: 800, format: 'webp', quality: 85 })
```

**Sanity:**

```ts
const cdn = sanity({ projectId: 'abc123', dataset: 'production' })
cdn.url('image-abc123-800x600-jpg', { width: 400 })
```

**Storyblok:**

```ts
const cdn = storyblok()
cdn.url('https://a.storyblok.com/f/12345/photo.jpg', { width: 800 })
```

**Contentful:**

```ts
const cdn = contentful()
cdn.url('https://images.ctfassets.net/space/token/photo.jpg', { width: 800 })
```

**Vercel Image Optimization:**

```ts
const cdn = vercel({ origin: 'https://myapp.vercel.app' })
cdn.url('/photo.jpg', { width: 800, quality: 75 })
// → https://myapp.vercel.app/_vercel/image?url=%2Fphoto.jpg&w=800&q=75
```

**Cloudflare Images:**

```ts
const cdn = cloudflare('https://example.com')
cdn.url('/photo.jpg', { width: 800, format: 'webp' })
// → https://example.com/cdn-cgi/image/width=800,format=webp/photo.jpg
```

**ImageKit.io:**

```ts
const cdn = imagekit('https://ik.imagekit.io/your_id')
cdn.url('photo.jpg', { width: 800, format: 'webp' })
// → https://ik.imagekit.io/your_id/photo.jpg?tr=w-800,f-webp
```

**TwicPics:**

```ts
const cdn = twicpics('https://demo.twic.pics')
cdn.url('photo.jpg', { width: 800, format: 'webp' })
// → https://demo.twic.pics/photo.jpg?twic=v1/resize=800/output=webp
```

**Netlify Image CDN:**

```ts
const cdn = netlify({ origin: 'https://myapp.netlify.app' })
cdn.url('/photo.jpg', { width: 800, format: 'webp', quality: 75 })
// → https://myapp.netlify.app/.netlify/images?url=%2Fphoto.jpg&w=800&fm=webp&q=75
```

**Gumlet:**

```ts
const cdn = gumlet('https://demo.gumlet.io')
cdn.url('photo.jpg', { width: 800, format: 'webp' })
// → https://demo.gumlet.io/photo.jpg?w=800&format=webp
```

**Use with VImage:**

```vue
<script setup lang="ts">
import { cloudinary } from 'vue-image-kit/cdn'
const cdn = cloudinary({ cloudName: 'my-cloud' })
</script>

<template>
  <VImage
    src="/photo.jpg"
    alt="Photo"
    :srcset="cdn.srcset('/photo.jpg', [400, 800, 1200])"
    sizes="(max-width: 768px) 100vw, 50vw"
  />
</template>
```

### Auto CDN detection

`autoLoader()` looks at a URL's hostname and picks the right adapter for you —
no per-provider wiring when the asset is already served from a recognizable
CDN host. It fingerprints 8 of the 12 adapters this way: Cloudinary, imgix,
Bunny, ImageKit, Sanity, Storyblok, Contentful, Gumlet. Returns the URL
**unchanged** when nothing matches, so it's safe to run over every `src`
unconditionally — a local `/images/photo.jpg` just passes through.

```ts
import { autoLoader } from 'vue-image-kit/cdn'

autoLoader('https://res.cloudinary.com/demo/image/upload/photo.jpg', { width: 800 })
// → https://res.cloudinary.com/demo/w_800,q_auto,f_auto/image/upload/photo.jpg

autoLoader('/local/photo.jpg', { width: 800 })
// → '/local/photo.jpg' — no recognized CDN host, unchanged
```

The other 4 adapters (Netlify, Vercel, Cloudflare, TwicPics) run on **your
own** domain rather than a distinctive one, so there's no hostname to
fingerprint — pass them explicitly via `config.hosts`, keyed by your actual
domain:

```ts
import { autoLoader, netlify } from 'vue-image-kit/cdn'

autoLoader(src, { width: 800 }, {
  hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) },
})
```

`autoSrcset()` is the same detection, building a real per-width `srcset` (one
distinct URL per width, via the adapter's own `.srcset()`) instead of a
single URL — unlike `autoLoader`, it returns `undefined` rather than the
input unchanged when nothing is detected, since there's no sensible
"unchanged srcset" to fall back to:

```ts
import { autoSrcset } from 'vue-image-kit/cdn'

autoSrcset('https://mysite.imgix.net/photo.jpg', [400, 800, 1200])
// → 'https://mysite.imgix.net/photo.jpg?w=400&auto=format 400w, ...'
```

### Auto CDN detection with VImage

`VImage`'s `cdn` prop wires `autoLoader()`/`autoSrcset()` straight into the
component — no manual detection, no manual `src` rewriting:

```vue
<VImage src="https://res.cloudinary.com/demo/image/upload/photo.jpg" alt="Photo" cdn />
```

Combined with `widths`, each candidate gets a real CDN-transformed URL via
the adapter's `.srcset()` instead of `widths`' usual "same URL, different `w`
descriptor" behavior (`generateSrcset` — see "Network-aware loading" for why
that limitation exists for the non-CDN case):

```vue
<VImage
  src="https://mysite.imgix.net/photo.jpg"
  alt="Photo"
  cdn
  :widths="[400, 800, 1200]"
/>
```

Pass an `AutoLoaderConfig` object instead of `true` to cover the "your own
domain" providers (Netlify/Vercel/Cloudflare/TwicPics) via `hosts`, same as
`autoLoader()` itself:

```vue
<script setup lang="ts">
import { netlify } from 'vue-image-kit/cdn'
const cdnConfig = { hosts: { 'myapp.netlify.app': netlify({ origin: 'https://myapp.netlify.app' }) } }
</script>

<template>
  <VImage src="https://myapp.netlify.app/photo.jpg" alt="Photo" :cdn="cdnConfig" />
</template>
```

Has no effect on an unrecognized host (passthrough, same as `autoLoader`), or
on an explicit `SrcSet` object / `densities` — those are already
format/resolution choices you made by hand.

---

## buildSizes helper

Build a `sizes` attribute string from a breakpoint-keyed object — works with the plugin's named breakpoints.

```ts
import { buildSizes } from 'vue-image-kit'

const breakpoints = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }

buildSizes({ sm: '100vw', md: '50vw', default: '33vw' }, breakpoints)
// → '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
```

---

## generatePreloadLink

Generate a `<link rel="preload">` HTML string for critical above-the-fold images. Use in Nuxt's `useHead` or inject into SSR `<head>` to improve LCP.

```ts
import { generatePreloadLink, generateSrcset } from 'vue-image-kit'

const srcset = generateSrcset('/hero.jpg', [400, 800, 1200])

const link = generatePreloadLink('/hero.jpg', {
  srcset,
  sizes: '100vw',
})
// → '<link rel="preload" as="image" href="/hero.jpg" imagesrcset="..." imagesizes="100vw">'
```

**In Nuxt:**

```vue
<script setup lang="ts">
import { generatePreloadLink } from 'vue-image-kit'

useHead({
  link: [{ innerHTML: generatePreloadLink('/hero.jpg', { sizes: '100vw' }) }]
})
</script>
```

---

## useImagePreloader

Preload a batch of images before navigation — useful for galleries and carousels.

```vue
<script setup lang="ts">
import { useImagePreloader } from 'vue-image-kit'

const { preload, progress, isComplete, errors } = useImagePreloader()

async function goToNextSlide() {
  await preload(['/slide-2.jpg', '/slide-3.jpg'])
  // All images are cached — transition is instant
  currentSlide.value++
}
</script>

<template>
  <div v-if="!isComplete">Loading {{ progress }}%…</div>
</template>
```

---

## fetchpriority & decoding

Control browser prioritization and decoding strategy:

```vue
<!-- Hero image: load first, decode async -->
<VImage
  src="/hero.jpg"
  alt="Hero"
  :lazy="false"
  fetchpriority="high"
  decoding="async"
/>

<!-- Below-the-fold: deprioritize -->
<VImage
  src="/footer-banner.jpg"
  alt="Banner"
  fetchpriority="low"
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `fetchpriority` | `'high' \| 'low' \| 'auto'` | — | Browser fetch priority hint |
| `decoding` | `'async' \| 'sync' \| 'auto'` | `'async'` | Image decoding mode |

---

## Error retry

Automatically retry failed image loads with exponential backoff:

```vue
<VImage
  src="/flaky-image.jpg"
  alt="Photo"
  :max-retries="3"
  :retry-delay="500"
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `maxRetries` | `number` | `0` | Max retry attempts |
| `retryDelay` | `number` | `1000` | Initial delay in ms (doubles each retry) |

---

## Network-aware loading

`useNetworkAware()` wraps the browser's Network Information API — `saveData` (the
user opted into data savings) and `effectiveType` (`'slow-2g' | '2g' | '3g' | '4g'`).
SSR-safe (`saveData` starts `false` on the server) and reactive to the connection's
`change` event. Support is Chromium-only today (Firefox/Safari don't implement the
API) — `saveData` just stays `false` there, so nothing breaks, it simply can't help.

```ts
import { useNetworkAware } from 'vue-image-kit'

const { saveData, effectiveType } = useNetworkAware()
```

Two places already use it:

- **`useImagePreloader()`** silently skips `preload()` calls while `saveData` is on
  — preloading trades bandwidth for a smoother later transition, the wrong trade
  once the user asked to save data.
- **`VImage`'s `respectSaveData` prop** (opt-in, default `false`): while `saveData`
  is on, it neutralizes `priority` (the image stays lazy instead of being forced
  eager/high-priority) and downgrades `src` to the smallest URL it can actually
  find one for — the lowest key in a `densities` map, or the smallest `w` candidate
  in `image.srcset` (a manifest/`?vik` value). Plain `widths` has no distinct URL to
  downgrade to (see `generateSrcset` — the browser negotiates via the `w`
  descriptor against one URL, not a URL per width) so it's a no-op there.

```vue
<VImage
  src="/photo.jpg"
  alt="Photo"
  priority
  respect-save-data
  :densities="{ 1: '/photo.jpg', 2: '/photo@2x.jpg' }"
/>
```

For a direct check outside a component (e.g. before kicking off a batch preload
yourself), `isSaveDataEnabled()` is the same check without the reactive wrapper:

```ts
import { isSaveDataEnabled } from 'vue-image-kit'

if (!isSaveDataEnabled()) {
  await preload(nextSlideUrls)
}
```

---

## Layout presets

The `layout` prop switches how the wrapper is sized. Leaving it unset keeps the
current default — fills the container width, aspect-ratio preserved from
`width`/`height` — so nothing changes for existing usage.

**`fixed`** — an exact `width`×`height` box, no responsive scaling (like a
plain `<img width height>`):

```vue
<VImage src="/icon.jpg" alt="Icon" :width="64" :height="64" layout="fixed" />
```

**`responsive`** — same container-filling behavior as the default, plus an
auto-generated `sizes` from `width` when `sizes` isn't given explicitly
(`(min-width: {width}px) {width}px, 100vw` — "as wide as its intrinsic size,
otherwise the full viewport width"):

```vue
<VImage
  src="/photo.jpg"
  alt="Photo"
  :width="800"
  :height="600"
  :widths="[400, 800, 1200]"
  layout="responsive"
/>
```

**`fill`** — absolutely fills a positioned parent (`position: absolute; inset:
0`); the parent needs `position: relative` (or similar) itself. `width`/`height`
become optional — common for hero banners or cards where the container defines
the box:

```vue
<div style="position: relative; aspect-ratio: 16 / 9;">
  <VImage src="/hero.jpg" alt="Hero" layout="fill" fit="cover" priority />
</div>
```

---

## Nuxt module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-image-kit/nuxt'],
  vueImageKit: {
    breakpoints: {
      sm: '(max-width: 640px)',
      md: '(max-width: 1024px)',
    },
  },
})
```

After setup:
- `<VImage>` and `v-lazy-img` are available in all templates without imports
- All composables (`useImage`, `useImagePreloader`, etc.) are auto-imported
- All utilities (`generateSrcset`, `buildSizes`, `generatePreloadLink`, etc.) are auto-imported

### `onDemandServer` — on-demand images as a Nitro route

Set `onDemandServer` to register `vue-image-kit/server`'s handler as a real
Nitro server route via `addServerHandler` — no manual `server/routes/...`
file needed:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-image-kit/nuxt'],
  vueImageKit: {
    onDemandServer: true, // root defaults to Nuxt's own `public/` dir
  },
})
```

```vue
<VImage src="/photos/cat.jpg" alt="Photo" :widths="[400, 800]" loader="server" />
```

`onDemandServer: true` uses every default (root `public/`, route
`/_vik/image`); pass an object to override any of them — same options as
`createImageHandler` (`root`, `cacheDir`, `maxAge`, `allowedWidths`,
`maxWidth`), plus `route`:

```ts
vueImageKit: {
  onDemandServer: {
    root: 'assets/uploads',
    route: '/api/img',
    maxWidth: 2000,
  },
},
```

The route also becomes `loader="server"`'s default automatically — no need
to repeat it as `serverRoute` unless the handler lives somewhere this module
didn't register (e.g. deployed separately). `root` is only ever put in
**private** runtime config (`useRuntimeConfig().vueImageKitServer`, server
side only) — never exposed to the client, unlike `breakpoints`.

---

## Vite plugin

Process images at build time — same as the CLI but integrated into the Vite lifecycle. Runs on `buildStart` and re-runs in dev mode when source images change.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vueImageKit } from 'vue-image-kit/vite'

export default defineConfig({
  plugins: [
    vue(),
    vueImageKit({
      input: './src/images',
      output: './public/images',
      widths: [400, 800, 1200],
      manifest: './src/assets/images.ts',
    }),
  ],
})
```

All CLI options are supported. `sharp` must be installed as a dev dependency.

`buildStart`/`handleHotUpdate` call the same `generate()` the CLI does, so
[incremental generation](#incremental-generation) applies here too — and is
auto-enabled during `vite dev` specifically (not `vite build`) unless you set
`incremental` explicitly. A single source-file change in dev reprocesses just
that file, not the whole batch.

### Build-time imports

The plugin also resolves **query-suffixed imports**, so you never wire props by hand — the metadata comes straight into your JS at build time:

```ts
import meta from './photo.jpg?vik'
// → { src, srcset, webp, avif, width, height, placeholder, blurhash, thumbhash, name, src400, ... }

import hash from './photo.jpg?thumbhash'
// → 'base64string'
```

Pass the metadata straight to `<VImage>`'s `image` prop — no manual field wiring:

```vue
<script setup lang="ts">
import meta from './hero.jpg?vik'
</script>

<template>
  <VImage :image="meta" alt="Hero" />
</template>
```

- **`?vik`** resizes/encodes the image into `output` and returns the full manifest entry (URLs use `publicPath`, exactly like the generated manifest). The ThumbHash is always included.
- **`?thumbhash`** computes *only* the hash string and writes no files.

Both re-run when the source image changes in dev. `sharp` is required; `thumbhash` is required for hash output.

**TypeScript** — enable typed `?vik` / `?thumbhash` imports by referencing the bundled declarations once (e.g. in `env.d.ts`):

```ts
/// <reference types="vue-image-kit/vite/client" />
```

### On-demand dev serving

Both the CLI and the build-time imports above are **batch/ahead-of-time** —
they process images before they're requested. If you'd rather not run a build
step at all during development, set `dev.onDemand: true` and images resize
**on request** instead, cached to disk after the first hit:

```ts
vueImageKit({
  dev: { onDemand: true }, // mounts a handler at /_vik/image during `vite dev`
})
```

```html
<img src="/_vik/image?src=/photos/cat.jpg&w=800&format=webp" />
```

This is dev-only — `configureServer` (the Vite hook it uses) never runs during
`vite build`. For production without a CDN, mount the same handler in your own
server — see "Self-hosted on-demand server" below.

---

## Self-hosted on-demand server

No CDN, don't want to pre-run the CLI, want images resized per-request in
production too? `vue-image-kit/server` exports the same handler the Vite dev
middleware above uses — a small, framework-agnostic Node request handler you
mount yourself.

```ts
import { createImageHandler } from 'vue-image-kit/server'

const handler = createImageHandler({ root: './public' })
```

**Plain Node `http`:**

```ts
import { createServer } from 'node:http'
import { createImageHandler } from 'vue-image-kit/server'

const imageHandler = createImageHandler({ root: './public' })

createServer((req, res) => {
  if (req.url?.startsWith('/_vik/image')) {
    imageHandler(req, res)
    return
  }
  // ...serve everything else
}).listen(3000)
```

**Express:**

```ts
app.get('/_vik/image', createImageHandler({ root: './public' }))
```

**Request shape:** `GET {route}?src=/photos/cat.jpg&w=800&format=webp&q=80` —
`src` is required (resolved strictly under `root`; anything that escapes it is
rejected with `403`, a nonexistent file with `404`). `w`, `format`
(`jpg`/`webp`/`avif`/`png`) and `q` are all optional. With neither `w` nor
`format`, the original bytes are streamed through untouched — no `sharp`
call, works for any file type. Otherwise the result is resized/re-encoded
with `sharp` and cached to disk (`cacheDir`, default `<root>/.vik-cache`)
keyed by every param that affects the output, so a repeat request is a cache
hit, not a re-encode.

```ts
buildImageUrl('/photos/cat.jpg', { width: 800, format: 'webp' })
// → '/_vik/image?src=%2Fphotos%2Fcat.jpg&w=800&format=webp'
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `root` | `string` | — | Required. Directory `src` is resolved (and confined) to. |
| `cacheDir` | `string` | `<root>/.vik-cache` | Where transformed output is cached. |
| `maxAge` | `number` | `31536000` (1 year) | `Cache-Control: public, max-age=..., must-revalidate`, plus a source-derived `ETag`. The response URL doesn't encode a content version, so a source file changing at the same `src` still needs to invalidate a client's cache — `must-revalidate` + `ETag` makes that a cheap conditional (304) request instead of serving stale bytes for the full `maxAge`. |
| `allowedWidths` | `number[]` | — | Restrict `w` to exactly these values (`400` on anything else). Unset: any positive integer, clamped to `maxWidth`. |
| `maxWidth` | `number` | `4000` | Upper bound for `w` when `allowedWidths` isn't set. |

**Scope**: this handles one transform per request for standard raster sources
(jpg/png/webp/avif → jpg/webp/avif/png) — the realistic "give me this photo
at width X" case. It does not replicate the CLI's GIF/SVG special-casing or
multi-variant batch generation (`src/cli/processor.ts` is the place for
that) — a `.gif`/`.svg` source always passes through untouched, byte-identical,
regardless of `w`/`format` (sharp is never asked to resize a GIF here — that
would silently drop its animation — or rasterize an SVG). Any other
unrecognized source extension falls back to `jpg` when a transform is
requested, or passes through untouched when neither `w` nor `format` is set.

**Security note**: error responses include the underlying error message as
plain text (e.g. "sharp is not installed") to make self-hosted setups easier
to debug. If you don't want that detail reaching clients, put this behind
your own error-handling middleware in production.

### Wiring VImage to it — `loader="server"`

`VImage`'s `loader` prop builds request URLs against the handler
automatically — no manual `buildImageUrl()` calls:

```vue
<VImage src="/photos/cat.jpg" alt="Photo" :widths="[400, 800]" loader="server" />
```

Same shape as `cdn`: combined with `widths`, each candidate gets its own
request URL instead of one shared URL. The route defaults to `/_vik/image`
(matching the Vite dev middleware and the handler's own convention) —
override it per-component with `loaderRoute`, or set it once for every
`VImage` via the Vue plugin (`app.use(VImageKitPlugin, { serverRoute:
'/api/img' })`) or the Nuxt module's `onDemandServer` option (see "Nuxt
module" above, which also registers the actual Nitro route for you). If both
`cdn` and `loader="server"` are set on the same image, `cdn` wins — an
external CDN already resolves the image, the local on-demand server is the
fallback for when there isn't one.

---

## Demo

Clone the repo and run the demo locally:

```bash
git clone https://github.com/macrulezru/vue-image-kit.git
cd vue-image-kit
npm run demo
```

The dev server starts at `http://localhost:5173`. No extra setup required — the demo imports directly from `src/` via Vite alias.

| Tab | What it shows |
|---|---|
| **Basic** | `<VImage>` props playground — live controls for all options, all loading states |
| **Blurhash & LQIP** | Side-by-side blurhash canvas vs base64 blur-up; live blurhash string input |
| **Color & Shimmer** | `placeholderMode` comparison — blur vs ThumbHash vs solid average color vs animated shimmer |
| **AVIF / WebP** | Format switching via `<picture>`, browser format detection, file size comparison |
| **srcset** | Three previews at 400 / 800 / 1200 px — `currentSrc` changes with `sizes`; live `sizes` editor |
| **Density 1x/2x/3x** | Density descriptors for fixed-size images; live `generateDensitySrcset` output and device DPR |
| **Responsive sources** | Art direction with named breakpoints — `<source media="...">` switching |
| **Focal point** | `:focal="{ x, y }"` → `object-position` with a draggable marker over a cropped frame |
| **Layout & priority** | `layout="fixed" \| "responsive" \| "fill"` side by side; `priority` (eager + `fetchpriority="high"`) |
| **Lazy Load** | 20+ images with per-item status badges; configurable `rootMargin` and `threshold` |
| **v-lazy-img** | 36-card grid with background-image lazy loading; LQIP toggle; event log |
| **Background image** | `useBackgroundImage()` — lazy + responsive `image-set()` background with blur-up |
| **Encode (upload)** | Client-side `encodeThumbHash` / `encodeBlurhash` from an uploaded file, with decoded preview |
| **Error State** | Default SVG fallback vs custom `#error` slot; `@error` event log; `maxRetries` exponential backoff demo |
| **Headless** | `useImage()` composable with fully custom markup and reactive state display |
| **CDN adapters** | Live URL / srcset builder for all 12 providers (Cloudinary, imgix, Bunny, Sanity, Storyblok, Contentful, Vercel, Cloudflare, ImageKit, TwicPics, Netlify, Gumlet) |
| **Build-time imports** | The `?vik` / `?thumbhash` workflow explained, with the resolved metadata shape |

### Nuxt demo

The Vite demo above covers the component/CLI/CDN/server features but nothing
Nuxt-specific. `demo-nuxt/` is a separate, minimal Nuxt 3 app (same
"import straight from `src/`" trick, via `nuxt.config.ts`'s `vite.resolve.alias`)
that exercises exactly the parts the Vite demo can't: module registration +
`breakpoints`, auto-imported composables/utilities with zero explicit
imports, `onDemandServer` actually registering a working Nitro route, and
server-rendered `<VImage>` output (`isSSR` branch) — verified against both
`nuxt dev` and a real `nuxt build` output.

```bash
npm run demo:nuxt        # installs demo-nuxt's own deps + starts nuxt dev
npm run demo:nuxt:build  # production build (.output/), no dev server
```

---

## Bundle size & peer dependencies

| Entry point | Raw | Gzip | Peer deps |
|---|---|---|---|
| `vue-image-kit` ESM | 42.1 kB | **13.0 kB** | `vue ^3.0` |
| `vue-image-kit` CJS | 31.9 kB | **11.3 kB** | `vue ^3.0` |
| `vue-image-kit/cdn` ESM | 10.8 kB | **2.4 kB** | — |

Measured from the actual build output (`npm run build`), not maintained by hand — CI fails if this drifts past the thresholds in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

Ships as tree-shakeable **ESM** (`vue-image-kit.js`) and **CommonJS** (`vue-image-kit.cjs`).
`"sideEffects": false` in `package.json` — unused exports are eliminated by the bundler. If you only import `vLazyImg` or a single composable, the bundler will exclude everything else (VImage, blurhash decoder, etc.).

**Tree-shaking example — use only the directive:**

```ts
// Only vLazyImg and its IO logic is included in the bundle.
// VImage, useBlurhash, decodeBlurhash are not imported → not bundled.
import { vLazyImg } from 'vue-image-kit'
app.directive('lazy-img', vLazyImg)
```

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Bugs and questions — [issues](https://github.com/macrulezru/vue-image-kit/issues)

---

## 💖 Support the project

Open source takes time and effort. If this package saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
