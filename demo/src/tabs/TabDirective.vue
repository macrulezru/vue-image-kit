<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'

const usePlaceholder = ref(true)
const reloadKey = ref(0)
const statuses = ref<Record<number, 'idle' | 'loaded' | 'error'>>({})
const log = ref<string[]>([])

const ITEMS = 66

// Options are computed ONCE per reloadKey/usePlaceholder change.
// Each item gets a stable object reference → directive's `updated` hook
// sees the same src → skips reconnect → no reactivity loop.
const itemOptions = computed(() =>
  Array.from({ length: ITEMS }, (_, i) => {
    const img = images[i % images.length]
    return {
      src: img.src,
      ...(usePlaceholder.value ? { placeholder: img.placeholder } : {}),
      rootMargin: '0px',
      onLoad: () => {
        statuses.value[i] = 'loaded'
        const ts = new Date().toLocaleTimeString()
        log.value = [`[${ts}] #${i + 1} loaded`, ...log.value].slice(0, 6)
      },
      onError: () => {
        statuses.value[i] = 'error'
        const ts = new Date().toLocaleTimeString()
        log.value = [`[${ts}] #${i + 1} error`, ...log.value].slice(0, 6)
      },
    }
  }),
)

function getStatus(i: number): 'idle' | 'loaded' | 'error' {
  return statuses.value[i] ?? 'idle'
}

function reload() {
  statuses.value = {}
  log.value = []
  reloadKey.value++
  document.querySelector('.main')?.scrollTo({ top: 0 })
}

const loadedCount = computed(
  () => Array.from({ length: ITEMS }, (_, i) => i).filter((i) => getStatus(i) === 'loaded').length,
)
</script>

<template>
  <div>
    <p class="tab-title">v-lazy-img directive</p>
    <p class="tab-desc">
      Sets <code style="color: #e3b341">background-image</code> on any element when it enters the
      viewport. Scroll down to trigger loading. With a placeholder: blurred tiny thumbnail appears
      first, then transitions to the sharp image.
    </p>

    <!-- Controls -->
    <div class="panel" style="margin-bottom: 20px">
      <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap">
        <div class="control-row" style="margin: 0">
          <span class="control-label">Placeholder</span>
          <label class="toggle">
            <input type="checkbox" v-model="usePlaceholder" @change="reload" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
          <span style="font-size: 0.78rem; color: #8b949e">
            {{
              usePlaceholder
                ? 'blurred 20px LQIP → sharp (toggle to compare)'
                : 'no placeholder — grey until loaded'
            }}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto">
          <span style="font-size: 0.82rem; color: #8b949e"
            >{{ loadedCount }} / {{ ITEMS }} loaded</span
          >
          <button class="btn btn-primary" @click="reload">↺ Reset</button>
        </div>
      </div>
    </div>

    <div class="directive-layout">
      <!-- Left column: card grid -->
      <div>
        <p class="scroll-hint">↓ Scroll down to trigger lazy loading ↓</p>
        <div class="directive-grid" :key="reloadKey">
          <div
            v-for="(opts, i) in itemOptions"
            :key="`${reloadKey}-${i}`"
            v-lazy-img="opts"
            class="directive-card"
            :class="`card-status--${getStatus(i)}`"
          >
            <span class="card-badge badge" :class="`badge-${getStatus(i)}`">
              {{ getStatus(i) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Right column: sticky log + usage -->
      <div class="directive-sidebar-col">
        <div class="directive-sidebar">
          <!-- Event log -->
          <div class="panel">
            <p class="panel-title">Event log</p>
            <div class="log-body">
              <p v-for="(entry, i) in log" :key="i" class="log-entry">{{ entry }}</p>
              <p v-if="!log.length" class="log-empty">Scroll to trigger…</p>
            </div>
          </div>

          <!-- Usage code -->
          <div class="panel">
            <p class="panel-title">Usage</p>
            <pre class="code-block usage-code">
&lt;!-- string --&gt;
&lt;div v-lazy-img="'/bg.jpg'" /&gt;

&lt;!-- with LQIP placeholder --&gt;
&lt;div
  v-lazy-img="{
    src: '/bg.jpg',
    placeholder: 'data:...',
    rootMargin: '0px',
    onLoad: () => {},
    onError: (e) => {},
  }"
/&gt;</pre
            >
          </div>

          <!-- How it works -->
          <div class="panel">
            <p class="panel-title">With placeholder</p>
            <div class="how-it-works">
              <div>① Element enters viewport</div>
              <div>② Placeholder set as <code class="hl">background-image</code></div>
              <div>③ <code class="hl">filter: blur(8px)</code> applied</div>
              <div>④ Real image loads in background</div>
              <div>⑤ <code class="hl">background-image</code> swapped</div>
              <div>⑥ Blur transitions to 0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Two-column layout: cards left, sticky sidebar right */
.directive-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  /* no align-items: start — right column must stretch to full row height */
}

/* Grid item: stretches to the height of the card column (= tall containing block) */
.directive-sidebar-col {
  align-self: stretch;
}

/* Sticky wrapper inside the tall grid item — now has room to scroll */
.directive-sidebar {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scroll-hint {
  font-size: 0.75rem;
  color: #484f58;
  margin: 0 0 12px;
  text-align: center;
}

.log-body {
  min-height: 100px;
}

.log-entry {
  font-size: 0.78rem;
  color: #3fb950;
  margin: 0;
  padding: 3px 0;
  border-bottom: 1px solid #21262d;
}

.log-empty {
  font-size: 0.78rem;
  color: #484f58;
  margin: 0;
}

.usage-code {
  font-size: 0.72rem;
}

.how-it-works {
  font-size: 0.78rem;
  color: #8b949e;
  line-height: 1.7;
}

.hl {
  color: #e3b341;
}

.directive-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.directive-card {
  position: relative;
  aspect-ratio: 3 / 2;
  border-radius: 8px;
  background: #21262d center / cover no-repeat;
  overflow: hidden;
  /* overflow:hidden clips the scale(1.05) blur edge */
}

/* Show a subtle grey border while idle */
.card-status--idle {
  border: 1px solid #30363d;
}

.card-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  opacity: 1;
  transition: opacity 0.4s ease;
}

/* Fade out badge after loaded */
.card-status--loaded .card-badge {
  opacity: 0;
}
</style>
