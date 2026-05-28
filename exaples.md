<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    vue-toast-kit
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-toast-kit.webp"
    alt="vue-virtual-scroller-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Promise-API with auto type switching, priority queue with preemption, undo-actions with progress timer, toast grouping, headless mode, and a full design system via CSS custom properties — all with a single peer dependency (Vue 3).

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Demo](#demo)
- [Quick start — Vue 3](#quick-start--vue-3)
- [Quick start — Nuxt 3](#quick-start--nuxt-3)
- [useToast](#usetoast)
- [toast.promise](#toastpromise)
- [toast.undo](#toastundo)
- [Toast grouping](#toast-grouping)
- [ToastContainer](#toastcontainer)
- [useToastState — headless mode](#usetoaststate--headless-mode)
- [createToastContext — multi-instance](#createtoastcontext--multi-instance)
- [Stack mode (Sonner-style)](#stack-mode-sonner-style)
- [Event emitter](#event-emitter)
- [Rate limiting & localStorage persist](#rate-limiting--localstorage-persist)
- [Testing utilities](#testing-utilities)
- [Design System](#design-system)
- [Vue plugin](#vue-plugin)
- [Nuxt module](#nuxt-module)
- [TypeScript types](#typescript-types)
- [SSR compatibility](#ssr-compatibility)
- [Architecture](#architecture)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)
- [Migration from vue-toastification / vue-sonner](#migration-from-vue-toastification--vue-sonner)

---

## Features

- **Promise API** — `toast.promise(promise, messages)` automatically switches `loading → success / error` based on the result; returns the original promise unmodified
- **Priority queue** — four levels (`critical / high / normal / low`); when the visible limit is reached, high-priority toasts preempt low-priority ones; the preempted toast moves to a pending queue and reappears when space frees up
- **Undo actions** — `toast.undo(message, { undo: { onUndo, duration } })` renders a progress-bar timer; clicking "Undo" calls the callback and closes the toast; when the timer expires the action is confirmed silently
- **Grouping** — toasts with the same `groupKey` are stacked into one with a `+N` counter; clicking the counter expands the group
- **Headless mode** — `useToastState()` returns raw reactive queue data; render with any UI framework or fully custom markup
- **Multi-instance** — `createToastContext()` produces an isolated queue; pass it to `useToast(ctx)` and `<ToastContainer :context="ctx" />` for micro-frontends or scoped notification zones
- **Design System** — 30+ CSS custom properties (`--vtk-*`) covering colors, typography, shape, shadows, animations, and z-index; three built-in themes (`light`, `dark`, `system`); inline token override via the `theme` prop on `<ToastContainer>`
- **SSR-safe** — core has no browser API; toasts fired before `<ToastContainer>` mounts are buffered and flushed after mount (100 ms delay)
- **Accessibility** — `role="alert"` for `error / critical`, `role="status"` for others; `aria-live="assertive"` for critical; `Escape` closes the focused toast; focus returns to the previously active element on dismiss
- **Touch support** — swipe left or right to dismiss (configurable 40 % threshold)
- **RTL support** — CSS logical properties (`margin-inline-start`, `padding-inline`) adapt the layout automatically when `dir="rtl"` is set on `<html>`
- **Pause on hover / focus loss** — timers freeze automatically; `visibilitychange` stops all timers when the tab goes to the background
- **Animations** — CSS-only slide + fade per position; `prefers-reduced-motion` degrades to fade-only
- **Vue Plugin + Nuxt Module** — `app.use(VueToastPlugin)` for Vue 3; `modules: ['vue-toast-kit/nuxt']` for Nuxt 3 with auto-imports
- **Zero external runtime dependencies** — only Vue 3 as peer dep; full ESM + CJS, tree-shakeable

---

## Installation

```bash
npm install vue-toast-kit
```

Peer dependency:

```bash
npm install vue@>=3.3
```

---

## Demo

An interactive demo application is included in the `demo/` directory covering every feature in a tabbed interface.

```bash
git clone https://github.com/macrulezru/vue-toast-kit.git
cd vue-toast-kit
npm install
npm run demo
```

`npm run demo` installs demo dependencies automatically and starts the dev server.
Opens `http://localhost:5173`.

| Script | Description |
|---|---|
| `npm run demo` | Install demo deps (if needed) + start dev server |
| `npm run demo:dev` | Start dev server only (deps already installed) |
| `npm run demo:build` | Build demo for production |

| Tab | What it shows |
|---|---|
| 🔔 Basic | All toast types, positions, priorities, action buttons |
| ⚡ Promise | `toast.promise()` with resolve / reject simulation |
| ↩️ Undo | `toast.undo()` with progress timer, event log |
| 📦 Group | Stacking toasts by `groupKey`, expand on click |
| 🎨 Headless | `useToastState()` with fully custom render — zero package styles |
| 🔀 Multi-instance | `createToastContext()` — two isolated zones on one page |
| 🎨 Design System | Live CSS token editor with preset themes and CSS export |
| ✨ Animations | All 6 positions, animated grid picker |

---

## Quick start — Vue 3

**1. Register the plugin**

```ts
// main.ts
import { createApp } from 'vue'
import { VueToastPlugin } from 'vue-toast-kit'
import 'vue-toast-kit/style'
import App from './App.vue'

const app = createApp(App)
app.use(VueToastPlugin, { position: 'bottom-right', theme: 'system' })
app.mount('#app')
```

**2. Add the container**

```vue
<!-- App.vue -->
<template>
  <RouterView />
  <ToastContainer />
</template>
```

`<ToastContainer>` is registered globally by the plugin. No import needed.

**3. Fire toasts from anywhere**

```vue
<script setup lang="ts">
import { useToast } from 'vue-toast-kit'

const toast = useToast()
</script>

<template>
  <button @click="toast.success('Saved!')">Save</button>
  <button @click="toast.error('Something went wrong')">Fail</button>
</template>
```

Or use the named singleton outside components (Pinia stores, axios interceptors, route guards):

```ts
import { toast } from 'vue-toast-kit'

axios.interceptors.response.use(null, (err) => {
  toast.error(`Network error: ${err.message}`)
  return Promise.reject(err)
})
```

---

## Quick start — Nuxt 3

**1. Add the module**

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-toast-kit/nuxt'],
  vueToastKit: {
    position: 'top-right',
    theme: 'system',
    maxVisible: 5,
  },
})
```

**2. Add the container to your layout**

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <slot />
    <ToastContainer />  <!-- auto-imported -->
  </div>
</template>
```

**3. Use in pages and composables**

```vue
<script setup lang="ts">
// useToast and toast are auto-imported — no explicit import needed
const toast = useToast()

async function save() {
  await toast.promise(
    $fetch('/api/save', { method: 'POST', body: form }),
    { loading: 'Saving…', success: 'Saved!', error: (e) => e.message },
  )
}
</script>
```

---

## useToast

The main composable. Returns a `ToastApi` object. Works inside and outside Vue components.

```ts
const toast = useToast(context?: ToastContext): ToastApi
```

When called without arguments inside a component, it uses the injected context (set up by the plugin). When called outside a component it falls back to the global singleton. Pass a `ToastContext` from `createToastContext()` to use an isolated queue.

### Methods

| Method | Signature | Description |
|---|---|---|
| `toast()` | `(message, options?) → id` | Show an `info` toast |
| `toast.success()` | `(message, options?) → id` | Show a `success` toast |
| `toast.error()` | `(message, options?) → id` | Show an `error` toast (priority: `high` by default) |
| `toast.warning()` | `(message, options?) → id` | Show a `warning` toast |
| `toast.info()` | `(message, options?) → id` | Show an `info` toast |
| `toast.loading()` | `(message, options?) → id` | Show a `loading` toast (no auto-dismiss, not closable by default) |
| `toast.custom()` | `(component, options?) → id` | Replace the toast body with a Vue component |
| `toast.promise()` | `(promise, messages, options?) → Promise` | See [toast.promise](#toastpromise) |
| `toast.undo()` | `(message, options) → id` | See [toast.undo](#toastundo) |
| `toast.update()` | `(id, partial) → void` | Merge options (and optionally the message) into an existing toast |
| `toast.updateMessage()` | `(id, message) → void` | Update only the message text without touching options |
| `toast.dismiss()` | `(id?) → void` | Close a toast by id; omit id to close all |
| `toast.dismissAll()` | `(position?) → void` | Close all toasts, optionally filtered by position |
| `toast.isActive()` | `(id) → boolean` | Check if a toast is still visible |
| `toast.pauseAll()` | `() → void` | Pause all timers |
| `toast.resumeAll()` | `() → void` | Resume all timers |

### ToastOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | auto | Unique id; if the same id is already active the toast is updated |
| `type` | `ToastType` | `'info'` | Visual style; one of `info / success / warning / error / loading / custom` |
| `priority` | `ToastPriority` | `'normal'` | Queue priority; one of `critical / high / normal / low` |
| `duration` | `number` | `4000` | Auto-dismiss delay in ms; `0` = sticky (never auto-closes) |
| `position` | `ToastPosition` | container default | Render this toast at a specific position, regardless of the container's `position` prop |
| `closable` | `boolean` | `true` | Show the close button |
| `groupKey` | `string` | — | Group toasts with the same key into a stack |
| `icon` | `Component \| string \| false` | type default | SVG component, emoji string, or `false` to hide |
| `action` | `{ label, onClick }` | — | Extra action button inside the toast |
| `undo` | `{ label?, onUndo, duration? }` | — | Undo button with timer; see [toast.undo](#toastundo) |
| `onClose` | `() => void` | — | Called when the toast is closed (any reason) |
| `onAutoClose` | `() => void` | — | Called only when the timer expires |
| `pauseOnHover` | `boolean` | `true` | Pause the timer on mouse enter |
| `pauseOnFocusLoss` | `boolean` | `true` | Pause the timer when the tab goes to background |
| `swipeToDismiss` | `boolean` | `true` | Enable swipe left / right to dismiss on touch devices |
| `persist` | `boolean` | `false` | Restore from `localStorage` after reload (only for toasts without callbacks) |
| `component` | `Component` | — | Replace the entire toast body with a Vue component |
| `componentProps` | `Record<string, unknown>` | — | Props forwarded to `component` |
| `ariaLive` | `'assertive' \| 'polite'` | auto | Override the automatic aria-live value |
| `theme` | `'light' \| 'dark' \| 'system' \| ToastDesignTokens` | — | Per-toast theme or token overrides |

### Examples

**All toast types:**

```ts
toast.info('Sync complete')
toast.success('File uploaded')
toast.warning('Disk almost full (92 %)')
toast.error('Connection refused')
toast.loading('Fetching data…')
```

**Custom duration and position:**

```ts
toast.success('Copied to clipboard', {
  duration: 2000,
  position: 'top-center',
})
```

**With an action button:**

```ts
toast.info('New message from Alex', {
  action: {
    label: 'Open',
    onClick: () => router.push('/messages'),
  },
})
```

**Emoji icon:**

```ts
toast.success('Backup complete', { icon: '💾' })
```

**Sticky until manually dismissed:**

```ts
const id = toast.error('Server is down', { duration: 0, closable: true })
// Later:
toast.dismiss(id)
```

**Update an existing toast:**

```ts
const id = toast.loading('Uploading…')
// Update message only (no option changes):
toast.updateMessage(id, 'Processing…')
// Or update message + options together:
toast.update(id, { message: 'Almost done…', duration: 3000 })
```

**Rich content via Vue component:**

```ts
import RichCard from './RichCard.vue'

toast.custom(RichCard, {
  componentProps: { title: 'Hello', body: 'World' },
  duration: 0,
  closable: true,
})
```

---

## toast.promise

Automatically switches a `loading` toast to `success` or `error` based on the promise result. Returns the original promise so you can `await` it.

```ts
toast.promise<T>(
  promise: Promise<T>,
  messages: PromiseToastMessages<T>,
  options?: ToastOptions,
): Promise<T>
```

### PromiseToastMessages

| Field | Type | Description |
|---|---|---|
| `loading` | `string` | Message while the promise is pending |
| `success` | `string \| (data: T) => string` | Message on resolve; receives the resolved value |
| `error` | `string \| (err: unknown) => string` | Message on reject; receives the error |

### Examples

**Static messages:**

```ts
await toast.promise(
  fetch('/api/deploy').then(r => r.json()),
  {
    loading: 'Deploying…',
    success: 'Deployed successfully!',
    error:   'Deployment failed',
  },
)
```

**Dynamic messages from data / error:**

```ts
const user = await toast.promise(
  fetchUser(id),
  {
    loading: 'Loading user…',
    success: (u) => `Welcome, ${u.name}!`,
    error:   (e) => `Could not load user: ${(e as Error).message}`,
  },
)
```

**In a Pinia action:**

```ts
// stores/files.ts
import { toast } from 'vue-toast-kit'

export const useFileStore = defineStore('files', {
  actions: {
    async upload(file: File) {
      return toast.promise(
        uploadAPI(file),
        {
          loading: `Uploading ${file.name}…`,
          success: (res) => `${res.name} uploaded (${res.size} KB)`,
          error:   (e)   => `Upload failed: ${(e as Error).message}`,
        },
      )
    },
  },
})
```

The promise `reject` is re-thrown after updating the toast, so your `try / catch` or `.catch()` still fires normally.

---

## toast.undo

Creates a toast with a countdown progress bar. When the user clicks the undo button, `onUndo()` is called and the toast closes immediately. When the timer runs out, the toast closes silently (action confirmed).

```ts
toast.undo(message: string, options: ToastOptions & {
  undo: {
    onUndo: () => void | Promise<void>
    label?:   string   // default: 'Отменить'
    duration?: number  // ms, default: 5000
  }
}): string
```

### Examples

**Delete with undo:**

```ts
function deleteFile(id: string) {
  markForDeletion(id)

  toast.undo(`File "${fileName}" deleted`, {
    undo: {
      label: 'Restore',
      duration: 6000,
      onUndo: () => {
        restoreFile(id)
        toast.success('File restored')
      },
    },
    onAutoClose: () => permanentlyDelete(id),
  })
}
```

**Archive email:**

```ts
toast.undo('Email archived', {
  icon: '📨',
  undo: {
    onUndo: () => moveToInbox(emailId),
  },
})
```

**Async undo:**

```ts
toast.undo('Record deleted', {
  undo: {
    onUndo: async () => {
      await api.restore(recordId)
      toast.success('Record restored!')
    },
  },
})
```

---

## Toast grouping

Toasts with the same `groupKey` are collapsed into a single toast with a `+N` counter. Clicking the counter toggles the expanded state.

```ts
// All three calls produce one visible toast with "+2"
toast.info('New message from Alice', { groupKey: 'messages' })
toast.info('New message from Bob',   { groupKey: 'messages' })
toast.info('New message from Carol', { groupKey: 'messages' })
```

The leader toast (first in the group) stays visible; subsequent toasts are hidden but tracked. When the leader is dismissed, the next toast becomes the leader automatically.

### Grouping options

| Option | Behaviour |
|---|---|
| `groupKey: 'my-key'` | Enable grouping for this toast |
| No `groupKey` | Toast is always shown individually |

---

## ToastContainer

The Vue component that renders toasts. Place it once in `App.vue` (or in your Nuxt layout). Uses `<Teleport to="body">` internally.

```vue
<ToastContainer
  position="bottom-right"
  :max-visible="5"
  :gap="8"
  :offset-x="16"
  :offset-y="16"
  :z-index="9999"
  theme="system"
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `ToastPosition` | `'bottom-right'` | Default container position (per-toast `position` option overrides this) |
| `maxVisible` | `number` | `5` | Maximum number of toasts shown at once; extras wait in a pending queue |
| `gap` | `number` | `8` | Vertical gap between toasts in pixels |
| `offsetX` | `number` | `16` | Horizontal distance from the screen edge in pixels |
| `offsetY` | `number` | `16` | Vertical distance from the screen edge in pixels |
| `zIndex` | `number` | `9999` | CSS z-index of the container |
| `expand` | `boolean` | `false` | Expand all groups immediately (skip collapsed state) |
| `teleportTo` | `string` | `'body'` | CSS selector passed to `<Teleport>` |
| `context` | `ToastContext` | global | Pass an isolated context from `createToastContext()` |
| `theme` | `'light' \| 'dark' \| 'system' \| ToastDesignTokens` | — | Theme name or inline token overrides |
| `stackMode` | `boolean` | `false` | Sonner-style stack: inactive toasts collapse behind the front one; hover expands |

### Multiple containers

A single `<ToastContainer>` handles all positions automatically — each toast is rendered at its own `position` option, falling back to the container's `position` prop:

```ts
toast.success('Saved', { position: 'top-right' })
toast.error('Failed',  { position: 'bottom-center' })
// Both appear in their respective corners from one <ToastContainer>
```

For fully isolated queues (separate notification zones), use `createToastContext()` with a dedicated container:

```vue
<template>
  <!-- Default global queue — bottom right -->
  <ToastContainer position="bottom-right" />

  <!-- Critical alerts — top center, separate queue -->
  <ToastContainer position="top-center" :context="alertCtx" :z-index="10000" />
</template>

<script setup lang="ts">
import { createToastContext, useToast } from 'vue-toast-kit'
const alertCtx = createToastContext()
const alertToast = useToast(alertCtx)
</script>
```

### Slots

Override any part of the toast without losing the queue logic:

```vue
<ToastContainer>
  <!-- Replace the entire toast -->
  <template #toast="{ toast, dismiss }">
    <MyCustomToast :data="toast" @close="dismiss(toast.id)" />
  </template>
</ToastContainer>
```

| Slot | Props | Description |
|---|---|---|
| `#toast` | `{ toast, dismiss }` | Full replacement of one toast (skips all sub-slots) |
| `#toast-icon` | `{ toast }` | Replace the icon only; falls back to `ToastIcon` |
| `#toast-content` | `{ toast }` | Replace the entire message + actions area |
| `#toast-action` | `{ toast }` | Replace the action / undo buttons; falls back to `ToastActions` |
| `#toast-close` | `{ toast, dismiss }` | Replace the close button |
| `#toast-undo` | `{ toast, remaining }` | Replace the progress bar at the bottom of the toast |

---

## useToastState — headless mode

Returns raw reactive data from the queue. Use it to build a completely custom notification UI — `<ToastContainer>` is not needed.

```ts
const { active, pending, count, has } = useToastState(context?: ToastContext)
```

### Return value

| Property | Type | Description |
|---|---|---|
| `active` | `ComputedRef<ToastItem[]>` | Currently visible toasts (excluding hidden grouped ones) |
| `pending` | `ComputedRef<ToastItem[]>` | Toasts waiting for a slot |
| `count` | `ComputedRef<number>` | `active.value.length` |
| `has(id)` | `(id: string) → boolean` | Check if a toast is active |

### Example — fully custom render

```vue
<script setup lang="ts">
import { useToast, useToastState } from 'vue-toast-kit'

const toast = useToast()
const { active } = useToastState()
</script>

<template>
  <!-- No <ToastContainer> — render entirely from scratch -->
  <div class="my-notifications">
    <div
      v-for="t in active"
      :key="t.id"
      :class="`notification notification--${t.options.type}`"
      @mouseenter="t.pause()"
      @mouseleave="t.resume()"
    >
      <span>{{ t.message }}</span>
      <button @click="t.dismiss()">✕</button>
      <div class="progress" :style="{ width: `${t.remaining.value * 100}%` }" />
    </div>
  </div>
</template>
```

Each `ToastItem` in `active` is fully reactive:

| Property / Method | Type | Description |
|---|---|---|
| `id` | `string` | Unique id |
| `message` | `string \| VNode` | Toast content |
| `options` | `ToastOptions` (required) | Merged options |
| `createdAt` | `number` | `Date.now()` at creation |
| `remaining` | `Ref<number>` | 0–1, fraction of timer remaining |
| `isPaused` | `Ref<boolean>` | Timer is paused |
| `groupCount` | `Ref<number>` | 1 normally; >1 when grouping is active |
| `pause()` | `() → void` | Pause the timer |
| `resume()` | `() → void` | Resume the timer |
| `dismiss()` | `() → void` | Close the toast |
| `update(opts)` | `(Partial<ToastOptions>) → void` | Merge new options |

---

## createToastContext — multi-instance

Creates an isolated queue instance. Pass it to `useToast(ctx)` and `<ToastContainer :context="ctx" />` to completely separate the notification scope from the global one.

```ts
const ctx = createToastContext(options?: GlobalToastOptions): ToastContext
```

Use cases:
- Micro-frontend shells where each MFE manages its own notifications
- Modal dialogs with local status toasts that must not interfere with the app-level queue
- Multiple separate notification zones on one page

### Example

```vue
<script setup lang="ts">
import { createToastContext, useToast, ToastContainer } from 'vue-toast-kit'

const modalCtx = createToastContext({ maxVisible: 3 })
const modalToast = useToast(modalCtx)

function save() {
  modalToast.success('Changes saved inside the modal')
}
</script>

<template>
  <div class="modal">
    <button @click="save">Save</button>

    <!-- This container only shows toasts from modalCtx -->
    <ToastContainer
      :context="modalCtx"
      position="top-right"
      :z-index="10001"
    />
  </div>
</template>
```

---

## Design System

All visual properties are controlled by CSS custom properties (`--vtk-*`). Override them globally in `:root`, scoped to a container, or pass a `ToastDesignTokens` object as the `theme` prop.

### Built-in themes

```vue
<!-- Light (default) -->
<ToastContainer theme="light" />

<!-- Dark -->
<ToastContainer theme="dark" />

<!-- Follows prefers-color-scheme -->
<ToastContainer theme="system" />
```

### Inline token overrides

Pass a `ToastDesignTokens` object to override specific tokens without touching global CSS:

```vue
<ToastContainer
  :theme="{
    colorBg:      '#1a1a2e',
    colorText:    '#e2e8f0',
    colorSuccess: '#00ff88',
    colorError:   '#ff4d6d',
    borderRadius: '16px',
    shadow:       '0 8px 32px rgba(0, 0, 0, 0.5)',
    maxWidth:     '360px',
  }"
/>
```

### Full token reference

| Token | CSS Variable | Default (light) | Description |
|---|---|---|---|
| `colorBg` | `--vtk-color-bg` | `#ffffff` | Toast background |
| `colorText` | `--vtk-color-text` | `#1a1a1a` | Primary text color |
| `colorBorder` | `--vtk-color-border` | `rgba(0,0,0,0.08)` | Border color |
| `colorSuccess` | `--vtk-color-success` | `#16a34a` | Success accent |
| `colorError` | `--vtk-color-error` | `#dc2626` | Error accent |
| `colorWarning` | `--vtk-color-warning` | `#d97706` | Warning accent |
| `colorInfo` | `--vtk-color-info` | `#2563eb` | Info accent |
| `colorLoading` | `--vtk-color-loading` | `#7c3aed` | Loading accent |
| `fontFamily` | `--vtk-font-family` | system-ui | Font stack |
| `fontSize` | `--vtk-font-size` | `0.875rem` | Base font size |
| `fontWeight` | `--vtk-font-weight` | `400` | Base font weight |
| `lineHeight` | `--vtk-line-height` | `1.4` | Line height |
| `borderRadius` | `--vtk-border-radius` | `10px` | Corner radius |
| `borderWidth` | `--vtk-border-width` | `1px` | Border width |
| `shadow` | `--vtk-shadow` | multi-layer | Box shadow |
| `paddingX` | `--vtk-padding-x` | `1rem` | Horizontal padding |
| `paddingY` | `--vtk-padding-y` | `0.75rem` | Vertical padding |
| `iconSize` | `--vtk-icon-size` | `1.25rem` | Icon size |
| `progressHeight` | `--vtk-progress-height` | `3px` | Progress bar height |
| `maxWidth` | `--vtk-max-width` | `400px` | Maximum toast width |
| `minWidth` | `--vtk-min-width` | `280px` | Minimum toast width |
| `transitionDuration` | `--vtk-transition-duration` | `300ms` | Animation duration |
| `transitionEasing` | `--vtk-transition-easing` | ease | Animation easing |
| `zIndex` | `--vtk-z-index` | `9999` | Container z-index |

### Global CSS override

```css
/* styles/toasts.css */
:root {
  --vtk-border-radius: 6px;
  --vtk-font-family:   'Inter', sans-serif;
  --vtk-shadow:        0 2px 8px rgba(0, 0, 0, 0.15);
  --vtk-max-width:     360px;
}
```

---

## Vue plugin

```ts
import { VueToastPlugin } from 'vue-toast-kit'
import 'vue-toast-kit/style'

app.use(VueToastPlugin, {
  position:         'bottom-right',
  maxVisible:       5,
  duration:         4000,
  theme:            'system',
  closable:         true,
  pauseOnHover:     true,
  pauseOnFocusLoss: true,
  registerComponent: true,  // auto-register <ToastContainer> globally
})
```

### VueToastPluginOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `ToastPosition` | `'bottom-right'` | Default container position |
| `maxVisible` | `number` | `5` | Default maximum visible toasts |
| `duration` | `number` | `4000` | Default auto-dismiss duration in ms |
| `theme` | `'light' \| 'dark' \| 'system'` | — | Default theme for all containers |
| `closable` | `boolean` | `true` | Show close button by default |
| `pauseOnHover` | `boolean` | `true` | Pause on hover by default |
| `pauseOnFocusLoss` | `boolean` | `true` | Pause on tab background by default |
| `ignoreSSR` | `boolean` | `false` | Disable SSR buffering |
| `registerComponent` | `boolean` | `true` | Globally register `<ToastContainer>` |
| `rateLimit` | `number` | — | Max toasts added within `rateLimitWindowMs`; extras are silently dropped |
| `rateLimitWindowMs` | `number` | `1000` | Window in ms for rate limiting |
| `persistStorage` | `boolean` | `false` | Enable localStorage persist/restore for toasts with `persist: true` |

---

## Nuxt module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-toast-kit/nuxt'],

  vueToastKit: {
    position:         'bottom-right',
    maxVisible:       5,
    duration:         4000,
    theme:            'system',
    closable:         true,
    pauseOnHover:     true,
    pauseOnFocusLoss: true,
    registerComponent: true,
  },
})
```

The module automatically:
- Adds the Vue plugin on the client
- **Auto-imports** `useToast`, `useToastState`, `createToastContext`, and the `toast` singleton — no explicit import needed
- **Auto-imports** `<ToastContainer>` as a global component (when `registerComponent: true`)
- Injects `vue-toast-kit/style.css` into the Nuxt CSS pipeline

CSS is loaded automatically — no manual import of `vue-toast-kit/style` required in Nuxt.

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  ToastType,           // 'info' | 'success' | 'warning' | 'error' | 'loading' | 'custom'
  ToastPriority,       // 'critical' | 'high' | 'normal' | 'low'
  ToastPosition,       // 'top-left' | 'top-center' | 'top-right' | 'bottom-*'

  ToastOptions,        // Full options object
  ToastItem,           // Internal reactive toast item (used in headless mode)
  ToastAction,         // { label: string; onClick: () => void }
  ToastUndo,           // { label?: string; onUndo: () => void | Promise<void>; duration?: number }
  ToastDesignTokens,   // All CSS token keys typed

  PromiseToastMessages,// { loading, success, error }

  ToastContext,        // Isolated queue context
  GlobalToastOptions,  // Plugin / module options

  ToastApi,            // Return type of useToast()
} from 'vue-toast-kit'
```

**Working with `ToastItem` in headless mode:**

```ts
import type { ToastItem } from 'vue-toast-kit'

function renderCustomToast(t: ToastItem) {
  // t.remaining.value — number 0–1
  // t.isPaused.value  — boolean
  // t.groupCount.value — number
  // t.options.type, t.options.priority, etc.
}
```

**Typed token override:**

```ts
import type { ToastDesignTokens } from 'vue-toast-kit'

const darkGlass: ToastDesignTokens = {
  colorBg:      'rgba(15, 15, 20, 0.85)',
  colorText:    '#f0f0f0',
  borderRadius: '14px',
  shadow:       '0 8px 32px rgba(0,0,0,0.6)',
}
```

---

## SSR compatibility

| Scenario | Behaviour |
|---|---|
| `typeof window === 'undefined'` | `toast()` calls are buffered in `ToastBuffer`; no browser API is touched |
| `<ToastContainer>` mounts on the client | Buffer is flushed after 100 ms with all pending toasts |
| `ignoreSSR: true` | Buffer is disabled; SSR-fired toasts are discarded silently |
| Nuxt hydration | Plugin runs client-side only; SSR render produces no toast HTML |

```ts
// nuxt.config.ts — disable SSR buffer if you never fire toasts on the server
vueToastKit: { ignoreSSR: true }
```

---

## Architecture

```
useToast() / toast (singleton)
        │
        ├── buildToastApi(context)
        │     toast(), toast.success/error/warning/info/loading/custom()
        │     toast.promise()   — updates type + restarts timer
        │     toast.undo()      — wraps options.undo
        │     toast.dismiss()   — proxies to queue.dismiss()
        │
        ▼
   ToastContext
        │   addToast()  →  isServer ? ToastBuffer : ToastQueue.add()
        │   dismiss()   →  ToastQueue.dismiss()
        │   update()    →  ToastQueue.update()
        │
        ▼
   ToastQueue                    GroupManager
        active: ToastItem[]  ◄───────────────────┐
        pending: ToastItem[]      add(id, key)    │
        timers: Map<id, UndoTimer>  remove(id, key)│
                                  toggleExpand()  │
        add()  — dedup / preempt / sort pending   │
        remove() — free slot, promote from pending│
        update() — merge options                  │
        dismiss() — calls onClose, remove         │
                                                  │
   UndoTimer                                      │
        setTimeout/setInterval, pause/resume       │
        remaining: number (0–1)  ────────────────►│ ToastItem.remaining.value
        onExpire: () => queue.remove(id)          │
                                                  │
   ToastBuffer (SSR)                              │
        push() — store before window exists       │
        flush() — replay into queue at mount      │
        onFlush() — called by ToastContainer      │
                                                  │
   ToastContainer.vue                             │
        Teleport → body                           │
        TransitionGroup (slide + fade per position)│
        hover → queue.pauseAll() / resumeAll()    │
        visibilitychange → pause/resume           │
        slot: #toast / #toast-icon / …            │
        │                                         │
        └── Toast.vue                             │
              swipe (touch)                       │
              aria role + aria-live               │
              ToastIcon.vue (SVG + spinner)        │
              ToastProgressBar.vue (scaleX)       │
              action / undo buttons               │
              group counter (click → toggleExpand)│

Plugin (VueToastPlugin)                 Nuxt Module
  app.use() → installContext()            defineNuxtModule()
  provide(TOAST_CONTEXT_KEY, ctx)         addPlugin(), addImports()
  app.component('ToastContainer', …)      addComponent(), css inject
```

---

## Bundle size & peer dependencies

| Entry point | Size (gzip) | Peer deps |
|---|---|---|
| `vue-toast-kit` (JS) | ~9.2 KB | `vue ^3.3` |
| `vue-toast-kit/style` (CSS) | ~2.4 KB | — |
| `vue-toast-kit/nuxt` | ~0.6 KB | `vue ^3.3`, `@nuxt/kit` |

Ships as tree-shakeable ESM (`vue-toast-kit.js`) and CommonJS (`vue-toast-kit.cjs`).

---

## Stack mode (Sonner-style)

Enable `stackMode` on `<ToastContainer>` to collapse multiple toasts into a visual stack. The front toast is fully visible; behind it you see up to 2 ghost cards, slightly scaled and offset. Hovering the container expands them back to the normal stacked list.

```vue
<ToastContainer :stack-mode="true" position="bottom-right" />
```

Hover to expand, mouse-leave to collapse back.

---

## Event emitter

Subscribe to queue events for analytics integration (Sentry, Amplitude, etc.). All listeners return an unsubscribe function.

```ts
import { getOrCreateGlobalContext } from 'vue-toast-kit'

const queue = getOrCreateGlobalContext().queue

const off = queue.onAdd((item) => {
  analytics.track('toast_shown', { type: item.options.type, message: item.message })
})

queue.onDismiss((id) => {
  analytics.track('toast_dismissed', { id })
})

queue.onUpdate((id, partial) => {
  analytics.track('toast_updated', { id, ...partial })
})

// Unsubscribe when done:
off()
```

---

## Rate limiting & localStorage persist

```ts
import { createToastContext } from 'vue-toast-kit'

// Max 3 toasts per second; extras are silently dropped
const ctx = createToastContext({ rateLimit: 3, rateLimitWindowMs: 1000 })

// Restore toasts with persist:true after page reload
const ctx2 = createToastContext({ persistStorage: true })
```

Or configure globally via the plugin:

```ts
app.use(VueToastPlugin, {
  rateLimit: 5,
  persistStorage: true,
})
```

Mark individual toasts as persistent:

```ts
toast.info('Maintenance window tonight', { persist: true, duration: 0 })
// This toast survives a page reload
```

---

## Testing utilities

```ts
import { createMockToast, mockUseToast } from 'vue-toast-kit/testing'

// In a Vitest / Jest test:
describe('MyComponent', () => {
  it('calls toast.success on save', async () => {
    const mockToast = mockUseToast()
    vi.mock('vue-toast-kit', () => ({ useToast: () => mockToast }))

    // render component, trigger save…

    expect(mockToast.success).toHaveBeenCalledWith('Saved!')
  })
})

// Create a minimal ToastItem stub:
const item = createMockToast({
  message: 'Upload complete',
  options: { type: 'success', duration: 3000 },
})
```

---

## Migration from vue-toastification / vue-sonner

### API compatibility table

| vue-toastification | vue-sonner | vue-toast-kit |
|---|---|---|
| `useToast()` | — | `useToast()` |
| `toast(msg, { type: TYPE.SUCCESS })` | `toast.success(msg)` | `toast.success(msg)` |
| `toast(msg, { type: TYPE.ERROR })` | `toast.error(msg)` | `toast.error(msg)` |
| `toast(msg, { type: TYPE.WARNING })` | — | `toast.warning(msg)` |
| `toast(msg, { type: TYPE.INFO })` | `toast(msg)` | `toast.info(msg)` |
| `toast.loading(msg)` | `toast.loading(msg)` | `toast.loading(msg)` |
| `POSITION.BOTTOM_RIGHT` | — | `'bottom-right'` |
| `POSITION.TOP_CENTER` | — | `'top-center'` |
| `toast.dismiss(id)` | `toast.dismiss(id)` | `toast.dismiss(id)` |
| `toast.update(id, opts)` | — | `toast.update(id, opts)` |
| — | `toast.promise()` | `toast.promise()` |
| — | — | `toast.undo()` |
| — | — | Priority queue |
| — | — | Grouping |
| — | — | `useToastState()` headless |
| — | — | `createToastContext()` |

### Migrating from vue-toastification

```ts
// Before
import { useToast, TYPE, POSITION } from 'vue-toastification'
const toast = useToast()
toast('Hello', { type: TYPE.SUCCESS, position: POSITION.BOTTOM_RIGHT })

// After
import { useToast } from 'vue-toast-kit'
const toast = useToast()
toast.success('Hello')  // position is set globally in the plugin
```

### Migrating from vue-sonner

`toast.success()`, `toast.error()`, `toast.promise()`, and `toast.dismiss()` are identical. The only difference is that `<ToastContainer />` replaces `<Toaster />`:

```vue
<!-- Before (vue-sonner) -->
<Toaster position="bottom-right" />

<!-- After (vue-toast-kit) -->
<ToastContainer position="bottom-right" />
```

---

## License

MIT

---

## Author

macrulezru

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Bugs and questions — [issues](https://github.com/macrulezru/vue-toast-kit/issues)

---

## 💖 Support the project

Open source takes time and effort. If this package saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️




<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    vue-state-machine
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-state-machine.webp"
    alt="vue-virtual-scroller-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Lightweight reactive finite state machines (FSM / statechart) for Vue 3 — declarative states and transitions, parallel regions, guards, actions, persist, and a composable API — with a single peer dependency.

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [defineMachine](#definemachine)
- [useMachine](#usemachine)
- [Parallel states](#parallel-states)
- [useWizard](#usewizard)
- [useSharedMachine](#usesharedmachine)
- [Vue plugin](#vue-plugin)
- [DevTools](#devtools)
- [TypeScript types](#typescript-types)
- [SSR compatibility](#ssr-compatibility)
- [Architecture](#architecture)
- [XState v5 migration](#xstate-v5-migration)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)

---

## Features

- **`defineMachine()`** — pure config factory with dev-time validation; no Vue dependency — testable in Node
- **`useMachine()`** — composable that wraps a machine in Vue reactivity; reactive `state`, `context`, `send()`, `matches()`, `can()`
- **Guards** — synchronous predicates that block transitions; exception treated as `false`
- **Actions** — sync or async side-effects on entry, exit, or transition; return `Partial<context>` to update state
- **Event queue** — `send()` adds to a queue and processes events sequentially; no race conditions with async actions
- **Parallel regions** — multiple independent sub-machines active at the same time inside a state
- **`useWizard()`** — built on top of `useMachine`; `next()`, `prev()`, `goTo()`, async `canProceed`, `onEnter`/`onLeave` hooks, circular mode
- **Persist** — optional snapshot serialization to `localStorage` (or any custom `Storage`) per machine instance
- **Transition history** — configurable depth, useful for debugging and undo flows
- **`useSharedMachine()`** — singleton machine shared between unrelated components without Pinia
- **DevTools** — separate `/devtools` entry point; custom panel in Vue DevTools with state, context, history, and event sender
- **Full TypeScript** — `TState`, `TEvent`, `TContext` generics inferred automatically from the config
- **XState v5 compatible subset** — migrate by swapping `createMachine` → `defineMachine` and `assign()` → plain return value
- **SSR-safe** — no `window` / `localStorage` in the core; persist is silently skipped server-side
- **≤ 4 KB gzip** for the core (`defineMachine` + `useMachine`)

---

## Installation

```bash
npm install @macrulez/vue-state-machine
```

Peer dependency:

```bash
npm install vue@>=3.3
```

---

## Quick start

```vue
<script setup lang="ts">
import { defineMachine, useMachine } from 'vue-state-machine'

const trafficLight = defineMachine({
  id: 'traffic',
  initial: 'red',
  states: {
    red:    { on: { NEXT: { target: 'green' } } },
    green:  { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' } } },
  },
})

const { state, send } = useMachine(trafficLight)
</script>

<template>
  <div :class="state">
    <p>Current: {{ state }}</p>
    <button @click="send('NEXT')">Next</button>
  </div>
</template>
```

`state` is a reactive `Ref<'red' | 'green' | 'yellow'>`. Clicking the button transitions the machine and Vue re-renders automatically.

---

## defineMachine

Pure factory function. Validates the config and returns it with improved TypeScript types. Zero Vue dependency — can be called and tested in Node without a Vue app.

```ts
function defineMachine<TState, TEvent, TContext>(
  config: MachineConfig<TState, TEvent, TContext>
): MachineConfig<TState, TEvent, TContext>
```

### Config shape

```ts
const machine = defineMachine({
  id: 'login',              // unique identifier (required, used by DevTools and MachineStore)
  initial: 'idle',          // starting state
  context: {                // optional initial context (deep-cloned per instance)
    attempts: 0,
    error: null as string | null,
  },
  states: {
    idle: {
      on: {
        // event name → transition config
        SUBMIT: { target: 'loading', actions: [resetError] }
      }
    },
    loading: {
      on: {
        SUCCESS: { target: 'success' },
        FAILURE: { target: 'error', actions: [incrementAttempts] },
      }
    },
    error: {
      on: {
        RETRY: { target: 'idle', guard: canRetry }
      }
    },
    success: { type: 'final' },   // terminal — further send() calls are no-ops
  },
})
```

### `StateConfig` options

| Field | Type | Description |
|---|---|---|
| `on` | `Record<TEvent, TransitionConfig>` | Event handlers |
| `entry` | `Action[]` | Invoked when the machine enters this state |
| `exit` | `Action[]` | Invoked when the machine leaves this state |
| `type` | `'final'` | Terminal state — `isDone` becomes `true`, `send()` is ignored |
| `parallel` | `Record<string, SubMachineConfig>` | Parallel regions (see [Parallel states](#parallel-states)) |

### `TransitionConfig` options

| Field | Type | Description |
|---|---|---|
| `target` | `TState` | Destination state (TypeScript-checked against config) |
| `guard` | `Guard<TContext, TEvent>` | Synchronous predicate; `false` or thrown exception blocks the transition |
| `actions` | `Action<TContext, TEvent>[]` | Side-effects executed during the transition |

### Dev-time validation

In development (`import.meta.env.DEV !== false`), `defineMachine` throws descriptive errors for:

- Empty `config.id`
- `initial` not found in `states`
- Any `target` referencing a non-existent state

Validation is tree-shaken away in production builds.

### Guards and Actions

```ts
type Guard<TContext, TEvent> =
  (context: TContext, event: EventObject<TEvent>) => boolean

type Action<TContext, TEvent> =
  (context: TContext, event: EventObject<TEvent>) =>
    void | Partial<TContext> | Promise<Partial<TContext> | void>
```

**Guard rules:**
- Must be **synchronous** and **side-effect-free** — it is also called by `can()` reactively
- An exception thrown inside a guard is caught and treated as `false`
- `Promise` return values are not awaited — use actions for async work

**Action rules:**
- May be `async` — the event queue awaits each action before executing the next
- Return `Partial<TContext>` to merge updates into context; return `void` for side-effects only
- Actions execute in order: `exit` → `transition.actions` → `entry`

```ts
// Action that updates context
const incrementAttempts = (ctx: { attempts: number }) => ({
  attempts: ctx.attempts + 1,
})

// Async action — fetch result is merged into context
const loadUser = async (ctx, event: { type: 'LOAD'; id: number }) => {
  const user = await api.getUser(event.id)
  return { user }
}

// Guard
const canRetry = (ctx: { attempts: number }) => ctx.attempts < 3
```

---

## useMachine

Composable. Wraps a `MachineConfig` in Vue reactivity and exposes a rich API.

```ts
function useMachine<TState, TEvent, TContext>(
  config: MachineConfig<TState, TEvent, TContext>,
  options?: UseMachineOptions,
): MachineInstance<TState, TEvent, TContext>
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `historyLimit` | `number` | `50` | Maximum entries kept in `history`; oldest are dropped when exceeded (FIFO) |
| `persist.key` | `string` | — | localStorage key for snapshot persistence |
| `persist.storage` | `Storage` | `localStorage` | Custom storage backend (e.g. `sessionStorage`) |

### Return value

| Property | Type | Description |
|---|---|---|
| `state` | `Readonly<Ref<TState>>` | Current state — reactive |
| `context` | `Readonly<Ref<TContext>>` | Current context — reactive |
| `send` | `(event: TEvent \| EventObject<TEvent>) => Promise<void>` | Queue an event; resolves after the transition completes |
| `matches` | `(query) => boolean` | Check current state or region state (see below) |
| `can` | `(event: TEvent) => boolean` | `true` if the event would trigger a transition (guard evaluated synchronously) |
| `history` | `Readonly<Ref<TransitionRecord[]>>` | Past transitions, newest last |
| `isDone` | `ComputedRef<boolean>` | `true` when the current state has `type: 'final'` |
| `snapshot` | `ComputedRef<MachineSnapshot>` | Serializable snapshot of `{ state, context, history }` |
| `restore` | `(snapshot: MachineSnapshot) => void` | Restore state from a snapshot without running guards or actions |

### `send()` — event queue

Events are processed sequentially. Calling `send()` multiple times in the same tick queues all events and runs them one after the other. Each `send()` returns a `Promise` that resolves after that specific event is fully processed (including async actions).

```ts
// Safe to call in rapid succession — no race conditions
await send('SUBMIT')
// state is 'loading' here

send('SUCCESS')  // queued, not awaited
send('FAIL')     // also queued — but 'FAIL' will be ignored because 'SUCCESS' ran first
```

### `matches()` — checking state

```ts
// Simple string
matches('loading')                        // true if state === 'loading'

// Array — any of the states
matches(['idle', 'error'])                // true if state === 'idle' OR 'error'

// Object — check a parallel region
matches({ validation: 'invalid' })       // true if region 'validation' is in 'invalid'
```

### `can()` — checking transitions

`can()` evaluates the guard synchronously without side-effects. Use it to enable/disable buttons:

```ts
const { can } = useMachine(loginForm)

// In template
// :disabled="!can('RETRY')"
```

> **Important:** Guards used with `can()` must be synchronous and free of side-effects. This is a deliberate contract — `can()` is called reactively and must not trigger async operations.

### Persist — snapshot to localStorage

```ts
const { state, send } = useMachine(checkoutMachine, {
  persist: { key: 'checkout' },
})
// On mount: snapshot is restored from localStorage
// On every transition: snapshot is saved to localStorage
```

The snapshot includes `state`, `context`, and `history`. On the server (`typeof window === 'undefined'`) persist is silently disabled.

```ts
// Custom storage
const { send } = useMachine(machine, {
  persist: { key: 'my-key', storage: sessionStorage },
})
```

### Full example — login form

```vue
<script setup lang="ts">
import { defineMachine, useMachine } from 'vue-state-machine'
import type { Action, Guard } from 'vue-state-machine'

type Ctx = { attempts: number; error: string | null }
type Ev  = 'SUBMIT' | 'SUCCESS' | 'FAILURE' | 'RETRY'

const resetError:        Action<Ctx, Ev> = ()    => ({ error: null })
const incrementAttempts: Action<Ctx, Ev> = (ctx) => ({ attempts: ctx.attempts + 1 })
const canRetry:          Guard<Ctx, Ev>  = (ctx) => ctx.attempts < 3

const loginMachine = defineMachine<'idle'|'loading'|'error'|'success', Ev, Ctx>({
  id: 'login',
  initial: 'idle',
  context: { attempts: 0, error: null },
  states: {
    idle:    { on: { SUBMIT:  { target: 'loading', actions: [resetError] } } },
    loading: { on: { SUCCESS: { target: 'success' },
                     FAILURE: { target: 'error', actions: [incrementAttempts] } } },
    error:   { on: { RETRY:   { target: 'idle', guard: canRetry } } },
    success: { type: 'final' },
  },
})

const { state, context, send, can, isDone } = useMachine(loginMachine)

async function submit() {
  await send('SUBMIT')
  try {
    await api.login()
    send('SUCCESS')
  } catch (e) {
    send({ type: 'FAILURE', message: String(e) })
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <p v-if="state === 'error'">Failed. Attempts: {{ context.attempts }}/3</p>
    <button type="submit" :disabled="state === 'loading'">Login</button>
    <button v-if="state === 'error'" @click="send('RETRY')" :disabled="!can('RETRY')">
      Retry
    </button>
    <p v-if="isDone">Logged in!</p>
  </form>
</template>
```

---

## Parallel states

A state can declare `parallel` regions — a set of independent sub-machines that all become active when the parent state is entered and are destroyed when it is left.

```ts
const editor = defineMachine({
  id: 'editor',
  initial: 'editing',
  states: {
    editing: {
      parallel: {
        saving: {
          initial: 'idle',
          states: {
            idle:   { on: { START_SAVE: { target: 'saving' } } },
            saving: { on: { SAVE_DONE: { target: 'saved'  } } },
            saved:  {},
          },
        },
        validation: {
          initial: 'valid',
          states: {
            valid:   { on: { INVALIDATE: { target: 'invalid' } } },
            invalid: { on: { VALIDATE:   { target: 'valid'   } } },
          },
        },
      },
    },
    idle: {},
  },
})
```

`send()` delivers every event to **all active regions**. Each region handles it independently.

```ts
const { matches, send } = useMachine(editor)

matches('editing')                 // main state
matches({ saving: 'idle' })        // region check
matches({ validation: 'valid' })   // another region

await send('INVALIDATE')
matches({ validation: 'invalid' }) // true
matches({ saving: 'idle' })        // still true — unaffected
```

**Context conflict resolution:** when two regions return a `Partial<context>` that touches the same field, the **last region in declaration order wins**. A `console.warn` is emitted in dev mode naming the conflicting regions and field.

**Limitation:** parallel regions support one level of nesting. Regions cannot themselves contain `parallel`. This is a deliberate choice to control complexity.

---

## useWizard

A composable for multi-step forms built on top of `defineMachine`. The wizard machine is generated automatically from the steps array.

```ts
function useWizard<TContext>(
  steps: WizardStep<TContext>[],
  options?: WizardOptions,
): WizardInstance<TContext>
```

### `WizardStep`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique step identifier (becomes a state name internally) |
| `label` | `string?` | Display label |
| `component` | `Component?` | Vue component to render for this step |
| `canProceed` | `(ctx) => boolean \| Promise<boolean>` | Gate for `next()` and forward `goTo()`; may be async |
| `onEnter` | `(ctx) => void` | Called when the wizard enters this step |
| `onLeave` | `(ctx) => void` | Called when the wizard leaves this step |

### `WizardOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `initialStep` | `number` | `0` | Index of the starting step |
| `allowSkip` | `boolean` | `false` | Skip `canProceed` on forward `goTo()` |
| `circular` | `boolean` | `false` | `next()` wraps from last step back to first |

### Return value

| Property | Type | Description |
|---|---|---|
| `currentStep` | `Ref<WizardStep>` | Currently active step object |
| `currentIndex` | `ComputedRef<number>` | Zero-based index of the current step |
| `totalSteps` | `number` | Total number of steps |
| `progress` | `ComputedRef<number>` | `0` to `1` based on current index |
| `isFirst` | `ComputedRef<boolean>` | `true` on the first step |
| `isLast` | `ComputedRef<boolean>` | `true` on the last step |
| `history` | `Ref<string[]>` | IDs of visited steps |
| `next()` | `Promise<boolean>` | Advance; calls `canProceed` first; returns `false` if blocked |
| `prev()` | `void` | Go back (no guard) |
| `goTo(id)` | `Promise<boolean>` | Jump to step by id; respects `canProceed` unless `allowSkip` |
| `reset()` | `void` | Return to the initial step |

### Example

```vue
<script setup lang="ts">
import { useWizard } from 'vue-state-machine'
import type { WizardStep } from 'vue-state-machine'
import StepInfo    from './StepInfo.vue'
import StepAddress from './StepAddress.vue'
import StepPayment from './StepPayment.vue'

interface CheckoutCtx {
  name: string
  email: string
  address: string
}

const steps: WizardStep<CheckoutCtx>[] = [
  {
    id: 'info',
    label: 'Your info',
    component: StepInfo,
    canProceed: (ctx) => !!ctx.name && !!ctx.email,
  },
  {
    id: 'address',
    label: 'Delivery',
    component: StepAddress,
    canProceed: (ctx) => !!ctx.address,
  },
  {
    id: 'payment',
    label: 'Payment',
    component: StepPayment,
    onEnter: () => trackEvent('payment_step_entered'),
  },
]

const { currentStep, progress, isFirst, isLast, next, prev } = useWizard(steps)
</script>

<template>
  <div>
    <progress :value="progress" max="1" />

    <component :is="currentStep.component" />

    <nav>
      <button :disabled="isFirst" @click="prev">Back</button>
      <button v-if="!isLast" @click="next">Next</button>
      <button v-else @click="submit">Place order</button>
    </nav>
  </div>
</template>
```

### `canProceed` rules

- May return a `boolean` or a `Promise<boolean>`
- If it **returns `false`**, `next()` / forward `goTo()` return `false` and the wizard stays on the current step
- If it **throws**, the same outcome — `false` is returned, the error is logged to `console.error` in dev mode
- `prev()` and backward `goTo()` **never** check `canProceed`
- `allowSkip: true` disables `canProceed` for `goTo()` only; `next()` always checks it

---

## useSharedMachine

Creates or retrieves a singleton machine instance by `config.id`. Useful when unrelated components need to share the same running machine without prop-drilling or Pinia.

```ts
function useSharedMachine<TState, TEvent, TContext>(
  config: MachineConfig<TState, TEvent, TContext>,
  options?: UseMachineOptions,
): MachineInstance<TState, TEvent, TContext>
```

Requires `VueMachinePlugin` to be installed.

```ts
// In component A
const { state } = useSharedMachine(cartMachine)

// In component B (completely separate tree)
const { send } = useSharedMachine(cartMachine)

// Both share the same machine instance — same state, same context
await send('ADD_ITEM')  // component A's state.value updates reactively
```

If a machine with `config.id` is already registered in the store, the existing instance is returned. Otherwise a new one is created and registered automatically.

---

## Vue plugin

Install `VueMachinePlugin` to enable the global machine registry (`useMachineStore`, `useSharedMachine`) and DevTools integration.

```ts
import { createApp } from 'vue'
import { VueMachinePlugin } from 'vue-state-machine'
import App from './App.vue'

const app = createApp(App)
app.use(VueMachinePlugin)
app.mount('#app')
```

### `useMachineStore()`

Provides direct access to the global registry. Useful for debugging or admin UIs.

```ts
const store = useMachineStore()

store.register('cart', instance)    // register manually
store.unregister('cart')
store.get('cart')                   // MachineInstance | undefined
store.getAll()                      // Map<string, MachineInstance>
```

Calling `useMachineStore()` without the plugin installed throws a descriptive error.

---

## DevTools

The DevTools integration lives in a separate entry point so it never ends up in production bundles.

```ts
import { createApp } from 'vue'
import { VueMachinePlugin }  from 'vue-state-machine'
import { VueMachineDevtools } from 'vue-state-machine/devtools'
import App from './App.vue'

const app = createApp(App)
app.use(VueMachinePlugin)

// Only in development
if (import.meta.env.DEV) {
  app.use(VueMachineDevtools)
}

app.mount('#app')
```

**Panel features:**
- List of all registered machines (from `MachineStore`)
- Current state, context as a JSON tree, full transition history
- "Send Event" button — pick an event type and add a custom payload
- Timeline: every transition is emitted as a named DevTools timeline event with timestamp and payload

> `VueMachinePlugin` must be installed before `VueMachineDevtools`.

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  // Core config
  MachineConfig,
  StateConfig,
  TransitionConfig,
  SubMachineConfig,

  // Functions
  Guard,
  Action,

  // Events
  EventObject,

  // Runtime
  MachineInstance,
  UseMachineOptions,
  TransitionRecord,
  MachineSnapshot,
  TransitionResult,

  // Wizard
  WizardStep,
  WizardOptions,
  WizardInstance,

  // Store
  MachineStoreAPI,

  // Utility
  Ctx,
} from 'vue-state-machine'
```

### Generic inference

TypeScript infers `TState`, `TEvent`, and `TContext` from the config you pass to `defineMachine`. You rarely need to annotate them explicitly:

```ts
const machine = defineMachine({
  id: 'traffic',
  initial: 'red',       // TS infers TState = 'red' | 'green' | 'yellow'
  states: {
    red:    { on: { NEXT: { target: 'green' } } },   // TEvent = 'NEXT'
    green:  { on: { NEXT: { target: 'yellow' } } },
    yellow: { on: { NEXT: { target: 'red' } } },
  },
})

const { state } = useMachine(machine)
// state: Ref<'red' | 'green' | 'yellow'>
// send accepts only 'NEXT' — other strings are compile errors
```

For complex cases you can annotate explicitly:

```ts
const machine = defineMachine<
  'idle' | 'loading' | 'error' | 'success',
  'SUBMIT' | 'SUCCESS' | 'FAILURE' | 'RETRY',
  { attempts: number; error: string | null }
>({ ... })
```

---

## SSR compatibility

| Scenario | Behaviour |
|---|---|
| Server render | Core modules (`defineMachine`, `MachineRunner`, `useMachine`) have no `window` / `document` / `localStorage` references |
| `persist` on server | Silently disabled — `typeof window === 'undefined'` guard in the composable |
| Hydration | Call `restore(serverSnapshot)` inside `onMounted` to hydrate from a server-side snapshot without re-running guards or actions |
| `snapshot` | Serializable with `JSON.stringify` — pass from server to client via Nuxt `useState`, `useServerState`, or `<script>` injection |

**Nuxt SSR example:**

```vue
<script setup lang="ts">
import { useMachine } from 'vue-state-machine'
import { onMounted } from 'vue'

// Snapshot passed from the server via useAsyncData / useState
const serverSnapshot = useState('checkout-snapshot')

const { state, send, restore } = useMachine(checkoutMachine)

onMounted(() => {
  if (serverSnapshot.value) restore(serverSnapshot.value)
})
</script>
```

---

## Architecture

```
defineMachine(config)
    │
    ▼ dev-time validation + type narrowing
MachineConfig<TState, TEvent, TContext>
    │
    ▼ created inside useMachine()
MachineRunner  (pure class, zero Vue deps)
    │  getCurrentState() / getContext()
    │  canTransition(event) → boolean
    │  enqueue(event)  ──────────────────────────────┐
    │  transition(event) → Promise<TransitionResult>  │
    │                                                 │
    │  EventQueue (sequential processing)             │
    │  ├── guard check  (sync, exception = false)     │
    │  ├── exit actions (await each)                  │
    │  ├── transition actions (await each)            │
    │  ├── state update                               │
    │  └── entry actions (await each)                 │
    │       └── Partial<TContext> merged into context ◄┘
    │
    │  Parallel regions
    │  ├── SubMachineRunner per region (activated on state entry)
    │  ├── send() dispatches to all regions
    │  └── "last declared wins" on context conflict
    │
    ▼ wrapped in Vue reactivity
useMachine(config, options)
    │  state:   shallowRef<TState>
    │  context: shallowRef<TContext>
    │  history: shallowRef<TransitionRecord[]>  (FIFO, historyLimit)
    │  send()   → enqueue → sync refs after result
    │  matches() / can()
    │  snapshot / restore()
    │  onMounted: load persist snapshot
    │  on transition: save persist snapshot
    │
    ├──▶ MachineStore (provide/inject via VueMachinePlugin)
    │        register() on composable creation
    │        useSharedMachine() → singleton by config.id
    │
    ▼
Vue components (template, setup)

useWizard(steps, options)
    │  buildWizardMachine() → generates MachineConfig from steps array
    │  useMachine(generatedConfig)
    │  next() → await canProceed → send('NEXT')
    │  goTo(id) → await canProceed (if forward) → send('GOTO_<id>')
    │  prev() → send('PREV')
    │
    ▼
WizardInstance (currentStep, progress, isFirst, isLast, history, ...)

VueMachineDevtools (separate entry point /devtools)
    │  reads MachineStore via app._context.provides
    │  hooks into __VUE_DEVTOOLS_GLOBAL_HOOK__
    │  emits timeline events per transition
    ▼
Vue DevTools browser extension panel "State Machines"
```

---

## XState v5 migration

`vue-state-machine` is API-compatible with a useful subset of XState v5. Migrating a simple machine typically takes minutes.

### API mapping

| XState v5 | vue-state-machine | Notes |
|---|---|---|
| `createMachine(config)` | `defineMachine(config)` | Config structure is identical |
| `useMachine(machine)` from `@xstate/vue` | `useMachine(config)` | Same composable shape |
| `send(event)` | `send(event)` | Identical |
| `matches(state)` | `matches(state)` | Identical |
| `context` in config | `context` in config | Identical |
| `on` handlers | `on` handlers | Identical |
| `entry` / `exit` | `entry` / `exit` | Identical |
| `type: 'final'` | `type: 'final'` | Identical |
| `guard` function | `guard` function | Same signature |
| `assign(updater)` | Return `Partial<context>` from action | No wrapper needed |
| `snapshot` / `restore` | `snapshot` / `restore` | Identical concept |
| `invoke` / services | **Not supported** | Move async work into actions |
| `spawn` / actor model | **Not supported** | Intentional scope limit |
| Hierarchical states | **Not supported** | Flat + parallel only |

### Step-by-step migration

**1. Replace the import and factory:**

```ts
// Before (XState v5)
import { createMachine } from 'xstate'
const machine = createMachine({ ... })

// After
import { defineMachine } from 'vue-state-machine'
const machine = defineMachine({ ... })
```

**2. Replace `assign()` with plain return values:**

```ts
// Before
import { assign } from 'xstate'
const increment = assign({ count: (ctx) => ctx.count + 1 })

// After — just return a partial context object
const increment = (ctx: { count: number }) => ({ count: ctx.count + 1 })
```

**3. Replace the Vue composable import:**

```ts
// Before
import { useMachine } from '@xstate/vue'

// After
import { useMachine } from 'vue-state-machine'
```

**4. Move async logic from `invoke` into actions:**

```ts
// Before (XState v5 invoke)
loading: {
  invoke: {
    src: (ctx, event) => fetch('/api/user'),
    onDone:  { target: 'success', actions: assign({ user: (_, e) => e.data }) },
    onError: { target: 'error' },
  }
}

// After — fire-and-forget inside the component or inside entry action
loading: {
  entry: [async (ctx, event) => {
    try {
      const user = await fetch('/api/user').then(r => r.json())
      return { user }       // merged into context; then send SUCCESS externally
    } catch {
      return { error: 'Failed' }
    }
  }]
}
```

---

## Bundle size & peer dependencies

| Entry point | Peer deps | Gzip |
|---|---|---|
| `vue-state-machine` | `vue ^3.3` | ≤ 4 KB (core) |
| `vue-state-machine/devtools` | `vue ^3.3`, `@vue/devtools-api` (peer) | separate chunk |

- Ships as tree-shakeable **ESM** (`dist/index.mjs`) and **CommonJS** (`dist/index.cjs`)
- `"sideEffects": false` in `package.json` — bundlers can eliminate unused exports
- The `/devtools` entry point is a separate chunk — importing it in `if (import.meta.env.DEV)` blocks ensures it is excluded from production bundles by standard tree-shaking

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Questions and bugs — [issues](https://github.com/macrulezru/vue-state-machine/issues)

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️



<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    vue-storage-kit
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-storage-kit.webp"
    alt="vue-virtual-scroller-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Reactive localStorage, sessionStorage, IndexedDB and cookies for Vue 3 — TTL, AES-GCM encryption, schema migrations with up/down functions, and cross-tab sync — all with a single peer dependency (Vue 3).

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Demo](#demo)
- [Quick start](#quick-start)
- [useStorage](#usestorage)
- [useLocalStorage / useSessionStorage](#uselocalstorage--usesessionstorage)
- [Schema migrations](#schema-migrations)
- [TTL and expiry](#ttl-and-expiry)
- [Encryption](#encryption)
- [Tab sync](#tab-sync)
- [useIndexedDB](#useindexeddb)
- [useIDBRef](#useidbref)
- [useCookie](#usecookie)
- [Vue plugin](#vue-plugin)
- [Nuxt module](#nuxt-module)
- [TypeScript types](#typescript-types)
- [SSR compatibility](#ssr-compatibility)
- [Architecture](#architecture)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)
- [Comparison with @vueuse/core](#comparison-with-vueuse-core)

---

## Features

- **useStorage** — unified reactive `Ref` over `localStorage`, `sessionStorage`, or in-memory store; drop-in replacement for vueuse `useLocalStorage` / `useSessionStorage`
- **Schema migrations** — versioned data with `up` / `down` migration chains; runs automatically on version mismatch, writes back the migrated value
- **TTL** — optional time-to-live per key; lazy expiry checked on every read, no timers; manual `cleanExpired()` sweep for startup cleanup
- **AES-GCM encryption** — Web Crypto API (`crypto.subtle`), key derived from a password via PBKDF2 or supplied as a `CryptoKey`; salt + IV + ciphertext packed into a single base64 string; derived key cached in session memory
- **Cross-tab sync** — `BroadcastChannel` with `storage` event fallback; last-write-wins conflict resolution by timestamp; optional leader election via `navigator.locks`
- **useIndexedDB** — promise-based key-value API plus a reactive `useIDBRef` for a single key
- **useCookie** — reactive cookies with `expires`, `sameSite`, `secure`; SSR-aware (reads from `document.cookie` on client, from H3 event headers in Nuxt server context)
- **Vue plugin** — global prefix, default target, and default error handler
- **Nuxt module** — auto-imports all composables; wires up the plugin with runtime config
- **Serializer** — JSON with round-trip support for `Date`, `Map`, `Set`, and `undefined`; bring your own serializer via the `Serializer<T>` interface
- **SSR-safe** — falls back to in-memory storage when `window` is unavailable; `isReady` ref lets components show a skeleton until hydration
- **Zero external dependencies** — only Vue 3 as peer dep; `/crypto` and `/sync` are separate tree-shakeable entry points

---

## Installation

```bash
npm install vue-storage-kit
```

Peer dependency:

```bash
npm install vue@>=3.3
```

---

## Demo

A fully interactive demo application is included in the `demo/` directory.
It covers every feature of the package in a tabbed interface — no build step required.

```bash
git clone https://github.com/macrulezru/vue-storage-kit.git
cd vue-storage-kit
npm install
npm run demo
```

Opens `http://localhost:5173` automatically.

| Tab | What it shows |
|---|---|
| 🗄️ localStorage / session | `useLocalStorage`, `useSessionStorage`, `defineStorageKey`, `useStorageKeys` |
| ⏱️ TTL & expiry | Live countdown, `onExpire` callback, `remove()` |
| 🔄 Schema migrations | Seed v1 / v2 data, reload — migration chain runs automatically |
| 🔐 Encryption | AES-GCM write/read, raw base64 in storage vs decrypted value |
| 📡 Tab sync | `useBroadcastChannel` cross-tab chat + `useStorage` with `sync: true` (open two tabs) |
| 💾 IndexedDB | `useIDBRef` reactive note + `useIndexedDB` CRUD table |
| 🍪 Cookies | `useCookie` with JSON object and string, shows raw `document.cookie` |
| 📋 Storage list | `useStorageList` as a persistent to-do app |
| 🔧 Utilities | `getStorageQuota` bar, `exportStorage` / `importStorage` / `clearStorage` |
| 📦 Pinia persist | `createPiniaPersist` global plugin, shows raw persisted state |
| 🗜️ Compression | `compress` / `decompress` with size ratio, `CompressAdapter` |

---

## Quick start

```vue
<script setup lang="ts">
import { useLocalStorage } from 'vue-storage-kit'

const { value: theme } = useLocalStorage('theme', 'light')
</script>

<template>
  <button @click="theme = theme === 'light' ? 'dark' : 'light'">
    Current theme: {{ theme }}
  </button>
</template>
```

The value is persisted to `localStorage` and is reactive — changing `theme.value` writes to storage immediately.

---

## useStorage

The core composable. Works with `localStorage`, `sessionStorage`, and an in-memory fallback.

```ts
useStorage<T>(key: string, options: StorageOptions<T>): UseStorageReturn<T>
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultValue` | `T` | — | Value returned when the key is absent or has expired |
| `target` | `'local' \| 'session' \| 'memory'` | `'local'` | Storage backend |
| `ttl` | `number` | — | Time-to-live in milliseconds; `0` or omitted = no expiry |
| `version` | `number` | `1` | Schema version of the stored data |
| `migrations` | `Migration[]` | `[]` | Migration functions run when stored version differs from `version` |
| `encrypt` | `boolean \| EncryptOptions` | `false` | Enable AES-GCM encryption |
| `sync` | `boolean \| SyncOptions` | `false` | Enable cross-tab sync via `BroadcastChannel` |
| `serializer` | `Serializer<T>` | JSON serializer | Custom serialize / deserialize pair |
| `onError` | `(err: StorageError) => void` | — | Called instead of throwing on quota exceeded, parse errors, crypto errors |
| `onExpire` | `(key: string) => void` | — | Called when a TTL-expired key is removed on read |
| `onMigrate` | `(from: number, to: number) => void` | — | Called after a successful migration |

### Return value

| Property | Type | Description |
|---|---|---|
| `value` | `Ref<T>` | Reactive two-way binding; assigning writes to storage |
| `isReady` | `Ref<boolean>` | `false` until the initial async read completes (important for IndexedDB and encrypted values) |
| `error` | `Ref<StorageError \| null>` | Last error, `null` if none |
| `expiry` | `ComputedRef<Date \| null>` | When the key expires, `null` if no TTL |
| `remove()` | `void` | Delete the key from storage and reset `value` to `defaultValue` |
| `refresh()` | `Promise<void>` | Re-read from storage (useful if another process may have written) |

### Examples

**Basic read/write:**

```ts
const { value: counter } = useStorage('counter', { defaultValue: 0 })

counter.value++  // writes to localStorage immediately
```

**Session storage:**

```ts
const { value: token } = useStorage('auth-token', {
  defaultValue: '',
  target: 'session',
})
```

**TTL — auto-expire after 30 minutes:**

```ts
const { value: cache, expiry } = useStorage('search-cache', {
  defaultValue: [] as string[],
  ttl: 30 * 60 * 1000,
  onExpire: (key) => console.log(`${key} expired`),
})

console.log(expiry.value) // Date | null
```

**Error handling:**

```ts
const { value, error } = useStorage('data', {
  defaultValue: {},
  onError: (err) => {
    if (err.type === 'quota-exceeded') showToast('Storage is full')
    if (err.type === 'parse-error') console.warn('Corrupted value, reset to default')
  },
})
```

**Custom serializer:**

```ts
import type { Serializer } from 'vue-storage-kit'

const base64Serializer: Serializer<string> = {
  serialize: (v) => btoa(v),
  deserialize: (raw) => atob(raw),
}

const { value } = useStorage('encoded', {
  defaultValue: '',
  serializer: base64Serializer,
})
```

---

## useLocalStorage / useSessionStorage

Shorthand composables — identical to `useStorage` but with `target` pre-set and `defaultValue` as the second argument (vueuse-compatible signature).

```ts
useLocalStorage<T>(key: string, defaultValue: T, opts?): UseStorageReturn<T>
useSessionStorage<T>(key: string, defaultValue: T, opts?): UseStorageReturn<T>
```

```ts
import { useLocalStorage, useSessionStorage } from 'vue-storage-kit'

const { value: settings } = useLocalStorage('settings', { theme: 'light', lang: 'en' })
const { value: draft }    = useSessionStorage('draft', '')
```

These are drop-in replacements for `@vueuse/core` `useLocalStorage` / `useSessionStorage`.

---

## Schema migrations

When the shape of stored data changes between releases, `SchemaManager` runs migration functions automatically. Each migration has a `version` (the target version), an `up` function (upgrade), and an optional `down` function (rollback).

### How it works

1. On read, the stored envelope's version is compared to `options.version`.
2. If they differ, the migration chain is built and applied sequentially.
3. The migrated value is written back to storage with the new version.
4. `onMigrate(from, to)` is called.

If downgrading and a `down()` is missing, the key resets to `defaultValue` and `onError` is called.

### Example — v1 → v3

```ts
import { useStorage } from 'vue-storage-kit'

interface SettingsV3 {
  theme: 'light' | 'dark'
  locale: string
}

const { value: settings } = useStorage<SettingsV3>('settings', {
  defaultValue: { theme: 'light', locale: 'en' },
  version: 3,
  migrations: [
    {
      version: 2,
      // v1 had { darkMode: boolean }, v2 introduces theme string
      up:   (d: any) => ({ ...d, theme: d.darkMode ? 'dark' : 'light' }),
      down: (d: any) => { const { theme, ...rest } = d; return { ...rest, darkMode: theme === 'dark' } },
    },
    {
      version: 3,
      // v2 had no locale, v3 adds it from the old lang field
      up:   (d: any) => ({ ...d, locale: d.lang ?? 'en' }),
      down: (d: any) => { const { locale, ...rest } = d; return { ...rest, lang: locale } },
    },
  ],
  onMigrate: (from, to) => console.log(`Migrated settings ${from} → ${to}`),
})
```

A user on v1 opens the app, reads `{ darkMode: true }`, and receives `{ darkMode: true, theme: 'dark', locale: 'en' }` after the chain runs. The migrated value is persisted immediately.

### `Migration` interface

```ts
interface Migration {
  version: number                       // target version after this migration
  up:   (data: unknown) => unknown      // upgrade from version-1 to version
  down?: (data: unknown) => unknown     // optional rollback from version to version-1
}
```

> Migrations must be **idempotent** — running `up` twice must not corrupt data.

---

## TTL and expiry

TTL is stored inside the envelope alongside the data (`exp` field). On every read, if `Date.now() > exp`, the key is deleted and `defaultValue` is returned.

```ts
const { value: otp, expiry, remove } = useStorage('otp', {
  defaultValue: '',
  ttl: 5 * 60 * 1000,   // 5 minutes
  onExpire: () => router.push('/login'),
})
```

**Manual cleanup on app start** — sweep all expired keys with a shared prefix:

```ts
import { TTLManager, StorageAdapterFactory } from 'vue-storage-kit'

const adapter = StorageAdapterFactory.get('local')
TTLManager.cleanExpired(adapter, 'myapp:')
```

**Check when a specific key expires:**

```ts
const exp = TTLManager.getExpiry(adapter, 'otp')
console.log(exp?.toLocaleTimeString())  // e.g. "14:35:00"
```

---

## Encryption

Encryption is handled by the `/crypto` subpackage using the browser's native Web Crypto API — no external libraries. Encrypted values are stored as a single base64 string: `salt[16] + iv[12] + ciphertext`.

### Encrypt with a password (PBKDF2)

```ts
const { value: secret } = useStorage('api-key', {
  defaultValue: '',
  encrypt: { password: 'user-passphrase', iterations: 100_000 },
})
```

### Encrypt with a pre-generated CryptoKey

```ts
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
)

const { value } = useStorage('vault', {
  defaultValue: {},
  encrypt: { key },
})
```

### Use the encryption functions directly

The `/crypto` entry point exports `encrypt` and `decrypt` for use outside of `useStorage`:

```ts
import { encrypt, decrypt } from 'vue-storage-kit/crypto'

const ciphertext = await encrypt('sensitive data', { password: 'pass', iterations: 10_000 })
const plaintext  = await decrypt(ciphertext, { password: 'pass', iterations: 10_000 })
```

### `EncryptOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `password` | `string` | — | Derive AES-GCM key from this password via PBKDF2 |
| `key` | `CryptoKey` | — | Use a pre-existing `CryptoKey` directly |
| `iterations` | `number` | `100_000` | PBKDF2 iteration count |

Either `password` or `key` must be provided. Derived keys are cached in memory — PBKDF2 runs only on the first encrypt/decrypt with a given `(password, salt)` pair.

---

## Tab sync

When `sync: true`, writes to `value` are broadcast to all other open tabs via `BroadcastChannel`. Remote updates are applied silently (without writing back to storage). Falls back to `window.addEventListener('storage', ...)` if `BroadcastChannel` is unavailable.

```ts
const { value: cart } = useStorage('cart', {
  defaultValue: [] as CartItem[],
  sync: true,
})
// cart.value stays in sync across all tabs automatically
```

### `SyncOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `channel` | `string` | `'vue-storage-kit'` | `BroadcastChannel` name |
| `leader` | `boolean` | `false` | Enable leader election — only one tab writes to storage on conflict |
| `debounce` | `number` | `50` | Milliseconds to debounce outgoing broadcasts |

**Leader election** uses `navigator.locks`. The leader tab holds a named lock for its lifetime. When the leader closes, another tab automatically acquires the lock and becomes the new leader. When `leader: true`, conflicts are resolved as last-write-wins by timestamp — on a tie the leader's version is kept.

```ts
const { value: sharedState } = useStorage('shared', {
  defaultValue: { count: 0 },
  sync: { channel: 'app-sync', leader: true, debounce: 100 },
})
```

### Use TabSync directly

```ts
import { TabSync } from 'vue-storage-kit/sync'

const sync = new TabSync({ channel: 'custom-channel', leader: true })
await sync.start()

sync.subscribe('my-key', (rawValue) => {
  console.log('Received from another tab:', rawValue)
})

sync.broadcast('my-key', JSON.stringify({ count: 1 }), Date.now())
sync.stop()
```

---

## useIndexedDB

Promise-based key-value access to an IndexedDB object store. The store is created automatically if it does not exist.

```ts
useIndexedDB<T>(dbName: string, storeName: string, onError?): UseIndexedDBReturn<T>
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `get` | `(key: IDBValidKey) => Promise<T \| null>` | Read a value by key |
| `set` | `(key: IDBValidKey, value: T) => Promise<void>` | Write a value |
| `delete` | `(key: IDBValidKey) => Promise<void>` | Remove a key |
| `keys` | `() => Promise<IDBValidKey[]>` | All keys in the store |
| `getAll` | `() => Promise<T[]>` | All values |
| `clear` | `() => Promise<void>` | Delete everything in the store |
| `count` | `() => Promise<number>` | Number of entries |
| `transaction` | `<R>(fn: (store: IDBObjectStore) => IDBRequest<R>) => Promise<R>` | Raw IDB transaction |

### Example

```ts
import { useIndexedDB } from 'vue-storage-kit'

interface Blob { id: number; data: ArrayBuffer }

const idb = useIndexedDB<Blob>('my-db', 'blobs', (err) => console.error(err))

await idb.set(1, { id: 1, data: buffer })
const blob = await idb.get(1)
console.log(await idb.count())

// Raw transaction
await idb.transaction((store) => store.put({ id: 2, data: buffer2 }, 2))

await idb.delete(1)
await idb.clear()
```

---

## useIDBRef

A reactive `Ref` that reads from and writes to a single IndexedDB key. Useful when you want the same reactive API as `useStorage` but backed by IndexedDB.

```ts
useIDBRef<T>(
  dbName: string,
  storeName: string,
  key: IDBValidKey,
  defaultValue: T,
): { value: Ref<T>; isReady: Ref<boolean>; error: Ref<StorageError | null> }
```

```ts
import { useIDBRef } from 'vue-storage-kit'

const { value: draft, isReady } = useIDBRef('editor-db', 'drafts', 'post-42', '')

// Once isReady.value === true, draft reflects the stored value
draft.value = 'Hello, world!'   // writes back to IDB automatically
```

---

## useCookie

A reactive `Ref` backed by `document.cookie`. Assigning to the ref sets the cookie. JSON serialization with `Date`, `Map`, `Set` support is included by default.

```ts
useCookie<T>(name: string, options: CookieOptions<T>): Ref<T>
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultValue` | `T` | — | Value returned when the cookie is absent |
| `expires` | `Date \| number` | — | Expiry as a `Date` or number of days |
| `path` | `string` | `'/'` | Cookie path |
| `domain` | `string` | — | Cookie domain |
| `secure` | `boolean` | — | Add `Secure` flag |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | — | `SameSite` attribute |
| `httpOnly` | `boolean` | — | SSR only — passed to H3 `setCookie`; ignored by browsers |
| `serializer` | `Serializer<T>` | JSON | Custom serializer |

### Examples

**Session cookie (expires when browser closes):**

```ts
const consent = useCookie('cookie-consent', { defaultValue: false })
consent.value = true
```

**Persistent cookie — 30 days:**

```ts
const locale = useCookie('locale', {
  defaultValue: 'en',
  expires: 30,
  sameSite: 'lax',
})
```

**Nuxt SSR — same API works on server and client:**

```vue
<script setup lang="ts">
// In Nuxt this delegates to the built-in useCookie on the server
const token = useCookie('auth-token', {
  defaultValue: '',
  secure: true,
  httpOnly: true,   // honored server-side via H3 setCookie
  sameSite: 'strict',
})
</script>
```

---

## Vue plugin

Install the plugin to configure a global key prefix, default target, and error handler.

```ts
import { createApp } from 'vue'
import { VueStoragePlugin } from 'vue-storage-kit'
import App from './App.vue'

const app = createApp(App)

app.use(VueStoragePlugin, {
  prefix:          'myapp:',    // all keys are prefixed automatically
  defaultTarget:   'local',
  onError: (err) => {
    if (err.type === 'quota-exceeded') showNotification('Storage full')
  },
})

app.mount('#app')
```

### `VueStoragePluginOptions`

| Option | Type | Description |
|---|---|---|
| `prefix` | `string` | Prepended to every storage key |
| `defaultTarget` | `StorageTarget` | Override the default `'local'` target |
| `defaultSerializer` | `Serializer<unknown>` | Replace the built-in JSON serializer globally |
| `defaultEncrypt` | `EncryptOptions` | Global encryption settings used when `encrypt: true` |
| `onError` | `(err: StorageError) => void` | Global error handler |

---

## Nuxt module

Add the module in `nuxt.config.ts` to auto-import all composables and register the plugin with a prefix from `runtimeConfig`.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-storage-kit/nuxt'],

  storageKit: {
    prefix:      'myapp_',
    autoImports: true,    // default: true
  },
})
```

With `autoImports: true` the following are available globally without an explicit import:

```ts
useStorage()
useLocalStorage()
useSessionStorage()
useIndexedDB()
useIDBRef()
useCookie()
```

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  // Storage targets
  StorageTarget,       // 'local' | 'session' | 'memory' | 'indexeddb'

  // Core options
  StorageOptions,
  CookieOptions,
  EncryptOptions,
  SyncOptions,

  // Migration
  Migration,

  // Serializer interface
  Serializer,

  // Internal envelope structure
  StorageEnvelope,

  // Error union
  StorageError,
  // { type: 'quota-exceeded'; key }
  // { type: 'parse-error'; key; raw }
  // { type: 'migration-failed'; from; to; error }
  // { type: 'crypto-error'; operation; error }

  // Low-level adapter interface
  StorageAdapter,

  // Return types
  UseStorageReturn,
  UseIndexedDBReturn,
  UseIDBRefReturn,

  // Plugin options
  VueStoragePluginOptions,
} from 'vue-storage-kit'
```

**`StorageError` discriminated union:**

```ts
import type { StorageError } from 'vue-storage-kit'

function handleError(err: StorageError) {
  switch (err.type) {
    case 'quota-exceeded':
      console.error('Storage full, key:', err.key)
      break
    case 'parse-error':
      console.error('Could not parse', err.key, '— raw:', err.raw)
      break
    case 'migration-failed':
      console.error(`Migration ${err.from} → ${err.to} failed:`, err.error)
      break
    case 'crypto-error':
      console.error(`Crypto ${err.operation} failed:`, err.error)
      break
  }
}
```

**Custom serializer type:**

```ts
import type { Serializer } from 'vue-storage-kit'

const msgpack: Serializer<unknown> = {
  serialize:   (v) => Buffer.from(encode(v)).toString('base64'),
  deserialize: (s) => decode(Buffer.from(s, 'base64')),
}
```

---

## SSR compatibility

| Scenario | Behaviour |
|---|---|
| `typeof window === 'undefined'` | All adapters fall back to `MemoryStorageAdapter` (in-process, not persisted) |
| `isReady.value === false` | The composable has not yet read from storage; show a skeleton or `v-if="isReady"` |
| `useCookie` on server (Nuxt) | Reads from `event.node.req.headers.cookie`; `httpOnly` cookies set via H3 `setCookie` |
| Hydration mismatch | `useStorage` re-reads the actual client value after mount — the SSR-rendered value is never used on the client |

```vue
<script setup lang="ts">
const { value: prefs, isReady } = useLocalStorage('prefs', { theme: 'light' })
</script>

<template>
  <SkeletonCard v-if="!isReady" />
  <UserPrefs v-else :prefs="prefs" />
</template>
```

---

## Architecture

```
vue-storage-kit
│
├── StorageAdapterFactory (singleton per target)
│     LocalStorageAdapter   → window.localStorage
│     SessionStorageAdapter → window.sessionStorage
│     MemoryStorageAdapter  → Map<string, string>  (SSR / 'memory' target)
│
├── StorageEnvelope  { v, d, exp, ts }
│     Wraps every stored value with schema version, serialized data,
│     expiry timestamp, and write timestamp
│
├── SchemaManager
│     Builds and runs migration chains (up or down)
│     Writes migrated value back with new version
│
├── TTLManager
│     Checks exp on every read (lazy expiry)
│     cleanExpired() — bulk sweep with optional prefix
│
├── createJSONSerializer
│     Handles Date, Map, Set, undefined via preProcess()
│     (preProcess walks the tree before JSON.stringify to avoid
│      Date.prototype.toJSON() hijacking the replacer)
│
├── useStorage
│     init() async: load crypto/sync modules if needed, read from storage
│     watch(value, flush:'sync') → writes on every assignment
│     setValueSilently() → updates ref without triggering the watcher
│     onScopeDispose → stops watcher and TabSync channel
│
├── useIndexedDB / useIDBRef
│     IndexedDBAdapter — lazily opens IDB, creates store on upgrade
│     useIDBRef watches the ref and calls adapter.set() on change
│
├── useCookie
│     Parses document.cookie on mount
│     watch → builds Set-Cookie string and assigns to document.cookie
│
├── /crypto  (separate entry point)
│     StorageEncryption — encrypt() / decrypt()
│     PBKDF2 key derivation; derived keys cached by (password, iterations, salt)
│     Output: base64(salt[16] + iv[12] + ciphertext)
│
├── /sync  (separate entry point)
│     LeaderElection — navigator.locks; holds lock for tab lifetime
│     TabSync — BroadcastChannel + storage event fallback
│               last-write-wins by timestamp; leader wins on tie
│
├── VueStoragePlugin
│     Sets global prefix, defaultTarget, defaultEncrypt, onError
│
└── Nuxt module (vue-storage-kit/nuxt)
      addImports — auto-import all composables
      addPlugin  — installs VueStoragePlugin with runtimeConfig.storageKit.prefix
```

---

## Bundle size & peer dependencies

| Entry point | Peer deps | Notes |
|---|---|---|
| `vue-storage-kit` | `vue ^3.3` | Core — adapters, composables, serializer, plugin |
| `vue-storage-kit/crypto` | `vue ^3.3` | AES-GCM encryption functions only |
| `vue-storage-kit/sync` | `vue ^3.3` | TabSync and LeaderElection only |
| `vue-storage-kit/nuxt` | `vue ^3.3`, `@nuxt/kit` (optional peer) | Nuxt module |

The package ships as tree-shakeable ESM (`dist/index.mjs`) and CommonJS (`dist/index.cjs`). The `/crypto` and `/sync` entry points are code-split — they are loaded dynamically inside `useStorage` only when `encrypt` or `sync` options are set, keeping the core footprint small.

---

## Comparison with @vueuse/core

`vue-storage-kit` extends and diverges from `@vueuse/core` in specific areas.

### Drop-in replacements

| @vueuse/core | vue-storage-kit | Notes |
|---|---|---|
| `useLocalStorage(key, default)` | `useLocalStorage(key, default)` | Same signature; `flush: 'sync'` by default |
| `useSessionStorage(key, default)` | `useSessionStorage(key, default)` | Same signature |
| `useCookies()` | `useCookie(name, options)` | Per-cookie reactive `Ref` instead of a single object |
| `useStorageAsync()` | `useIDBRef()` | Reactive `Ref` backed by async storage (IndexedDB) |
| `useBroadcastChannel()` | `useBroadcastChannel()` | Identical API |

### Extended functionality (no vueuse equivalent)

| Feature | vue-storage-kit |
|---|---|
| Schema migrations | `migrations: [{ version, up, down? }]` option in `StorageOptions` |
| TTL / expiry | `ttl` option (seconds); lazy check on read; no background timers |
| AES-GCM encryption | `encrypt: { password }` option; Web Crypto API only, no extra deps |
| Cross-tab sync | `sync: true` option; BroadcastChannel + storage event fallback |
| Leader election | `navigator.locks`-based leader in `LeaderElection` |
| IndexedDB full API | `useIndexedDB()` — get / set / delete / keys / getAll / transaction / indexes |
| Secondary IDB indexes | `useIndexedDB('db', 'store', onError, { indexes: [...] })` |
| CRUD collection | `useStorageList<T>()` — add / update / remove / find / findAll |
| Pinia persistence | `/pinia` entry point — `createPiniaPersist({ pick?, omit? })` |
| Compression | `/compress` entry point — `compress()` / `decompress()` via Compression Streams API |
| Export / Import | `exportStorage()` / `importStorage()` — snapshot and restore all keys |
| Shared instance cache | Two components calling `useStorage('key')` share one `Ref` — zero duplicated watchers |

### Behavioural differences

| Behaviour | @vueuse/core | vue-storage-kit |
|---|---|---|
| Watcher flush | `'pre'` (default Vue) | `'sync'` — write happens in the same microtask as the assignment |
| Cross-tab update | `storage` event only | `BroadcastChannel` with `storage` event fallback |
| Serialisation | JSON only | JSON + Date, Map, Set, BigInt round-trip; custom `Serializer<T>` |
| Multiple instances | Independent watchers per call | Shared reactive `Ref` via `instanceCache` |
| SSR | Global stubs | Same stubs; `useCookie` accepts H3 event for Nuxt server routes |

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Questions and bugs — [issues](https://github.com/macrulezru/vue-storage-kit/issues)

---

## 💖 Support the project

Open source takes time and effort. If my work saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️