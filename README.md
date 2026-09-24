# **Image Kit**

![Image Kit](https://github.com/macrulezru/assets/blob/master/packages-images/vue-image-kit.png?raw=true)

A complete image optimization toolkit for Vue 3. One `<VImage>` component handles lazy loading, WebP/AVIF format switching, responsive art direction, Blurhash and LQIP placeholders, automatic `srcset` generation, error retry with exponential backoff, and an optional fade-in transition — with **zero external runtime dependencies** and a small, tree-shakeable footprint.

Everything you need beyond the component is included: a **CLI** that processes images at build time (resize, convert, generate LQIP and BlurHash, write a TypeScript manifest), **CDN URL builders** for 12 providers (Cloudinary, imgix, Bunny, Sanity, Storyblok, Contentful, Vercel, Cloudflare, ImageKit, TwicPics, Netlify, Gumlet) with hostname auto-detection, a **Nuxt 3 module** with auto-imports, a **Vite plugin** (including on-demand dev serving), a **self-hosted on-demand image server** for when there's no CDN, and **headless composables** for fully custom markup.

Fully typed with TypeScript. Tree-shakeable (`sideEffects: false`). SSR-safe — renders a native `<img loading="lazy">` on the server, activates IntersectionObserver-based lazy loading after hydration.

---

## Features

**Placeholders**

- **Blurhash placeholder** — custom in-house decoder (no external packages); decodes to a small data URL applied as a CSS background on the image itself, swapped out once the real image loads; SSR renders the `<img>` directly, sized via `width`/`height` to preserve aspect-ratio
- **ThumbHash placeholder** — `thumbhash` prop on VImage auto-decodes to PNG data URL; supports alpha channel; better quality than BlurHash; `--thumbhash` flag in CLI generates hashes at build time
- **LQIP blur-up** — `data:image/…;base64,…` string as `placeholder`; low-res preview applied as a background image behind the real image, swapped out once it loads; optional `fadeIn` prop cross-fades the swap via CSS `opacity` transition
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
- **`useBreakpoints()`**, **`useLazyLoad()`** — the lower-level composables `VImage` itself is built on, exposed for fully custom markup
- **`useBlurhash()`** — decodes a BlurHash to a `<canvas>` for fully custom markup that wants its own placeholder element
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

## When you'd reach for this

An image is almost always the heaviest thing on a page — and almost always what determines LCP, the metric Google and real users judge loading speed by. vue-image-kit bundles the whole set of techniques usually applied one at a time by hand: the right format, lazy loading, placeholders, priority for the one image that matters most.

- **The hero image on screen shouldn't wait its turn** — A banner or product photo visible the moment the page opens gets priority and starts loading ahead of every other image — otherwise it's that image, not some small icon near the bottom, that decides how fast the page feels.
- **Images below the fold shouldn't load for nothing** — A feed of fifty photos doesn't pull all fifty files the moment the page opens — images far from the viewport only start loading once the user has scrolled nearly to them.
- **Images live in a CDN, not the project folder** — One project keeps images in Cloudinary, another in its own cloud, and each service builds the URL for a given size and format its own way — that URL gets assembled automatically for whichever provider is in use, instead of by hand for each one.
- **While a photo is still loading, its spot shouldn't be empty** — An empty box that suddenly turns into a picture makes the page jump and feels unpolished — the spot where an image hasn't loaded yet shows a blurred or color placeholder prepared ahead of time instead.

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
import '@macrulez/vue-image-kit/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(VImageKitPlugin)
app.mount('#app')
```

The CSS import ships the small set of layout/placeholder classes `<VImage>` relies on (box sizing per `layout` mode, the shimmer animation). It's a handful of plain, overridable classes, not a design system — nothing to configure.

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

`<VImage>`, `v-lazy-img`, all composables, and the CSS import from the Vue 3 example above are registered automatically — no imports needed.

### More examples

#### A different shot per screen, not just a different size

`sources` swaps in a genuinely different image — different crop, different composition — per breakpoint. Real art direction through `<picture>`, not a stretched resize of the same photo.

```vue
<template>
  <VImage
    src="/hero-desktop.jpg"
    alt="Hero"
    :sources="{
      sm: '/hero-mobile.jpg',
      md: '/hero-tablet.jpg',
    }"
  />
</template>

<!-- Generates a real <picture> with one <source media="..."> per
     breakpoint, sorted automatically, plus the fallback <img>. -->
```

Each breakpoint can also carry its own `width`/`height` (or a full build-time `ImageMeta` object, e.g. from a `?vik` import) when its crop has a different aspect ratio than the root image:

```vue
<template>
  <VImage
    src="/desktop-portrait.jpg"
    :width="720"
    :height="1237"
    :sources="{
      tablet: { src: '/tablet-landscape.jpg', width: 1400, height: 700 },
    }"
    :breakpoints="{ tablet: '(max-width: 1024px)' }"
    alt="Hero"
  />
</template>
```

Give `width`/`height` here and `VImage` reserves the box for the *active* breakpoint's own aspect ratio — not just the root image's — so the idle placeholder and blurhash decode already have the right proportions before the photo loads, and switching breakpoints never causes a layout shift. Without them, `<source>` renders with no dimensions and the placeholder falls back to the root `width`/`height`, exactly like before this existed. `width`/`height` are also both-or-nothing per entry: setting only one is ignored (with a dev warning) rather than distorting the box.

#### Respects Save-Data — doesn't pull the heavy version

`respect-save-data` downgrades `src` to the lightest candidate it can find and drops priority loading while the visitor has data-saving mode on — their phone decides, not the developer.

```vue
<template>
  <VImage
    src="/photo.jpg"
    alt="Photo"
    priority
    respect-save-data
    :densities="{ 1: '/photo.jpg', 2: '/photo@2x.jpg' }"
  />
</template>

<!-- While the visitor has Save-Data on: priority is neutralized (stays
     lazy instead of eager), and src downgrades to the lightest candidate
     it can find — the lowest density here, @1x instead of @2x. -->
```

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
