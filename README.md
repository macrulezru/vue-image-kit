# **Image Kit**

![Image Kit](https://github.com/macrulezru/assets/blob/master/packages-images/vue-image-kit.png?raw=true)

A complete image optimization toolkit for Vue 3. One `<VImage>` component handles lazy loading, WebP/AVIF format switching, responsive art direction, Blurhash and LQIP placeholders, automatic `srcset` generation, error retry with exponential backoff, and smooth CSS transitions — with **zero external runtime dependencies** and a small, tree-shakeable footprint.

Everything you need beyond the component is included: a **CLI** that processes images at build time (resize, convert, generate LQIP and BlurHash, write a TypeScript manifest), **CDN URL builders** for 12 providers (Cloudinary, imgix, Bunny, Sanity, Storyblok, Contentful, Vercel, Cloudflare, ImageKit, TwicPics, Netlify, Gumlet) with hostname auto-detection, a **Nuxt 3 module** with auto-imports, a **Vite plugin** (including on-demand dev serving), a **self-hosted on-demand image server** for when there's no CDN, and **headless composables** for fully custom markup.

Fully typed with TypeScript. Tree-shakeable (`sideEffects: false`). SSR-safe — renders a native `<img loading="lazy">` on the server, activates IntersectionObserver and canvas after hydration.

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
- **Responsive art direction** — named breakpoints map to `<source media="...">` elements
- **`fetchpriority` prop** — `high` for LCP images, `low` for below-the-fold
- **Error retry** — `maxRetries` prop with exponential backoff; automatically retries failed loads without manual intervention

**Loading**

- **IntersectionObserver lazy loading** — IO instead of `loading="lazy"` for precise control; configurable `rootMargin` and `threshold`; SSR-safe
- **IO pooling** — components sharing the same `rootMargin`+`threshold` config share one `IntersectionObserver` instance; no overhead at 50+ images
- **Background-image directive** — `v-lazy-img` sets `background-image` on any element after viewport entry; LQIP placeholder; configurable `transition`
- **`useBackgroundImage()`** — composable for lazy **+ responsive** (`image-set()`) backgrounds with blur-up

**Composables & utilities**

- **`useImage()`** — headless state machine (`idle → loading → loaded | error`) + computed `imgAttrs`; works with any markup
- **`useImagePreloader()`** — preload a batch of URLs before navigation; `{ loaded, total, progress, isComplete, errors }`
- **`useBlurhash()`**, **`useBreakpoints()`**, **`useLazyLoad()`** — the lower-level composables `VImage` itself is built on, exposed for fully custom markup
- **`useNetworkAware()`** — reactive save-data/connection-type state

**CDN adapters — `@macrulez/vue-image-kit/cdn`**

- Zero-dependency URL builders for **Cloudinary**, **imgix**, **Bunny CDN**, **Sanity**, **Storyblok**, **Contentful**, **Vercel**, **Cloudflare Images**, **ImageKit.io**, **TwicPics**, **Netlify Image CDN**, **Gumlet**
- Unified `.url(path, options)` / `.srcset(path, widths)` interface across all providers
- **`autoLoader()`** — detects 8 of the 12 providers straight from a URL's hostname, no per-image adapter wiring

**CLI — `npx vue-image-kit generate`**

- Resize images to multiple widths, convert to WebP/AVIF, generate LQIP base64, encode BlurHash
- Write a TypeScript manifest (`images.ts`) with all metadata pre-computed
- `sharp` as optional peer dependency — not included in the browser bundle

**Ecosystem**

- **Nuxt module** — `@macrulez/vue-image-kit/nuxt`; auto-registers `<VImage>` and `v-lazy-img`; auto-imports every composable and utility
- **Vite plugin** — `@macrulez/vue-image-kit/vite`; runs the CLI processor on `buildStart`; build-time imports via `?vik` / `?thumbhash` query suffixes; optional on-demand dev serving
- **Self-hosted on-demand server** — `@macrulez/vue-image-kit/server`; a small framework-agnostic Node request handler for when there's no CDN and a build step isn't wanted
- **Zero external runtime dependencies** — only Vue 3 as peer dep; full ESM + CJS, tree-shakeable, `sideEffects: false`

---

## Installation

| Peer dependency | Version    | Required                                                                                             |
| ------------------ | ------------ | -------------------------------------------------------------------------------------------------------- |
| `vue`           | `^3.0.0`   | yes                                                                                                    |
| `sharp`         | `>=0.33.0` | only for the CLI / Vite plugin / self-hosted server                                                     |
| `thumbhash`     | `>=0.1.0`  | only for the CLI's `--thumbhash` flag and the Vite plugin's `?thumbhash`/`?vik` build-time imports        |

```bash
npm install @macrulez/vue-image-kit
```

`sharp` and `thumbhash` are optional peer dependencies — install them only if you use the CLI, the Vite plugin, or the self-hosted server:

```bash
npm install sharp thumbhash --save-dev
```

### Quick start — Vue 3

```ts
// main.ts
import { createApp } from 'vue'
import { VImageKitPlugin } from '@macrulez/vue-image-kit'
import App from './App.vue'

const app = createApp(App)
app.use(VImageKitPlugin)
app.mount('#app')
```

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

### Quick start — Nuxt 3

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@macrulez/vue-image-kit/nuxt'],
  vueImageKit: {
    breakpoints: {
      sm: '(max-width: 640px)',
      md: '(max-width: 1024px)',
    },
  },
})
```

`<VImage>`, `v-lazy-img`, and all composables are registered automatically — no imports needed.

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/vue-image-kit](https://npm.vuecraft.ru/en/packages/vue-image-kit/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/vue-image-kit](https://github.com/macrulezru/vue-image-kit)
- 📦 **NPM:** [@macrulez/vue-image-kit](https://www.npmjs.com/package/@macrulez/vue-image-kit)
- 🐛 **Issues:** [github.com/macrulezru/vue-image-kit/issues](https://github.com/macrulezru/vue-image-kit/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
