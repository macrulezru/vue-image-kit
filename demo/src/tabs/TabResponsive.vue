<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const img = computed(() => images[selectedIdx.value])

// Local breakpoints for this component (merged with global ones from main.ts)
const localBreakpoints = {
  portrait: '(max-width: 480px)',
  custom: '(max-width: 900px)',
}

const sources = computed(() => ({
  sm: images[(selectedIdx.value + 1) % images.length].src,
  md: images[(selectedIdx.value + 2) % images.length].src,
  portrait: images[(selectedIdx.value + 3) % images.length].src,
}))

const currentSrc = ref('—')
const reloadKey = ref(0)

function onLoad(e: Event) {
  currentSrc.value = (e.target as HTMLImageElement).currentSrc
}

function reload() {
  currentSrc.value = '—'
  reloadKey.value++
}

// For the resolved sources table
const globalBreakpoints: Record<string, string> = {
  sm: '(max-width: 640px)',
  md: '(max-width: 1024px)',
}
const mergedBreakpoints = { ...globalBreakpoints, ...localBreakpoints }

const resolvedSources = computed(() =>
  Object.entries(sources.value)
    .map(([key, src]) => ({ key, media: mergedBreakpoints[key], src }))
    .filter((s) => s.media)
    .sort((a, b) => {
      const getMax = (m: string) => {
        const r = m.match(/max-width\s*:\s*([\d.]+)/)
        return r ? +r[1] : Infinity
      }
      return getMax(a.media) - getMax(b.media)
    }),
)
</script>

<template>
  <div>
    <p class="tab-title">Responsive sources — art direction</p>
    <p class="tab-desc">
      Define breakpoints globally via the plugin and reference them by name in
      <code style="color: #e3b341">:sources</code>. Add
      <code style="color: #e3b341">:breakpoints</code> directly on a component to extend or override
      globals. Source order is sorted automatically.
    </p>

    <div class="control-row" style="margin-bottom: 24px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx" @change="reload">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <button class="btn" @click="reload">↺ Reload</button>
      <span v-if="currentSrc !== '—'" style="font-size: 0.78rem; color: #3fb950">
        currentSrc: {{ currentSrc.split('/').pop() }}
      </span>
    </div>

    <div class="demo-grid" style="margin-bottom: 24px">
      <!-- Preview -->
      <div class="panel">
        <p class="panel-title">Preview — resize the window</p>
        <div
          style="
            aspect-ratio: 3/2;
            border-radius: 8px;
            overflow: hidden;
            background: #0d1117;
            margin-bottom: 12px;
          "
        >
          <VImage
            :key="reloadKey"
            :src="img.src"
            :alt="img.name"
            :width="img.width"
            :height="img.height"
            :blurhash="img.blurhash"
            :breakpoints="localBreakpoints"
            :sources="sources"
            :lazy="false"
            style="width: 100%; height: 100%"
            @load="onLoad"
          />
        </div>
        <p style="font-size: 0.78rem; color: #8b949e; margin: 0">
          Narrow the browser window — the image switches to a different photo matching the active
          breakpoint.
        </p>
      </div>

      <!-- How it works -->
      <div class="panel">
        <p class="panel-title">How it works</p>

        <p style="font-size: 0.78rem; color: #8b949e; margin: 0 0 6px">
          Global breakpoints (main.ts)
        </p>
        <pre class="code-block">
app.use(VImageKitPlugin, {
  breakpoints: {
    sm: '(max-width: 640px)',
    md: '(max-width: 1024px)',
  },
})</pre
        >

        <p style="font-size: 0.78rem; color: #8b949e; margin: 16px 0 6px">
          Per-component breakpoints (merged)
        </p>
        <pre class="code-block">
&lt;VImage
  src="/hero-desktop.jpg"
  :breakpoints="{
    portrait: '(max-width: 480px)',
    custom: '(max-width: 900px)',
  }"
  :sources="{
    sm: '/hero-mobile.jpg',
    portrait: '/hero-portrait.jpg',
    md: '/hero-tablet.jpg',
    custom: '/hero-custom.jpg',
  }"
/&gt;</pre
        >
      </div>
    </div>

    <!-- Resolved sources table -->
    <div class="panel">
      <p class="panel-title">Resolved &lt;source&gt; elements (after merge &amp; sort)</p>
      <div style="overflow-x: auto">
        <table class="sources-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>media</th>
              <th>srcset</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in resolvedSources" :key="s.key">
              <td class="col-key">{{ s.key }}</td>
              <td class="col-media">{{ s.media }}</td>
              <td class="col-src">{{ s.src }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="margin: 10px 0 0; font-size: 0.75rem; color: #484f58">
        Order is set automatically: max-width ascending, other queries appended last.
      </p>
    </div>
  </div>
</template>

<style scoped>
.code-block {
  margin: 0;
  overflow-x: auto;
}

.sources-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  white-space: nowrap;
}
.sources-table th {
  text-align: left;
  padding: 6px 12px;
  color: #8b949e;
  font-weight: 500;
  border-bottom: 1px solid #30363d;
}
.sources-table tr {
  border-bottom: 1px solid #21262d;
}
.col-key {
  padding: 7px 12px;
  color: #e3b341;
}
.col-media {
  padding: 7px 12px;
  color: #79c0ff;
}
.col-src {
  padding: 7px 12px;
  color: #a8daab;
}
</style>
