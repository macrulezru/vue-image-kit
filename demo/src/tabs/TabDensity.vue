<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateDensitySrcset } from 'vue-image-kit'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const densitiesInput = ref('1,2,3')
const reloadKey = ref(0)
const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
const liveSrc = ref('—')

const img = computed(() => images[selectedIdx.value])

const densities = computed(() =>
  densitiesInput.value
    .split(',')
    .map((d) => parseFloat(d.trim()))
    .filter((n) => !isNaN(n) && n > 0),
)

// Distinct file per density (recommended). Here we reuse the demo's existing
// 400/800/1200 renditions to stand in for 1x/2x/3x.
const fileMap = computed<Record<number, string>>(() => ({
  1: img.value.src400,
  2: img.value.src800,
  3: img.value.src1200,
}))

const mapSrcset = computed(() => generateDensitySrcset(fileMap.value, densities.value))
const singleSrcset = computed(() => generateDensitySrcset(img.value.src, densities.value))

function onLoad(e: Event) {
  const src = (e.target as HTMLImageElement).currentSrc
  liveSrc.value = src ? (src.split('/').pop() ?? '—').split('?')[0] : '—'
}

function reload() {
  liveSrc.value = '—'
  reloadKey.value++
}
</script>

<template>
  <div>
    <p class="tab-title">Density descriptors — 1x / 2x / 3x</p>
    <p class="tab-desc">
      For fixed-size images — icons, avatars, logos — width-based candidates don't apply. Density
      (<code style="color: #e3b341">x</code>) descriptors let the browser pick the file matching the
      device pixel ratio. <strong style="color: #f0f6fc">Each density should point at a different
      file</strong> (a 2× file has twice the pixels) — pass <code style="color: #e3b341">:densities</code>
      a per-density URL map.
    </p>

    <div class="control-row" style="margin-bottom: 20px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx" @change="reload">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <span class="control-label" style="margin-left: 12px">densities</span>
      <input class="control-input" style="width: 90px" v-model="densitiesInput" />
      <button class="btn" style="margin-left: auto" @click="reload">↺ Reload</button>
    </div>

    <div class="demo-grid">
      <div class="panel">
        <p class="panel-title">✓ Per-density files <span class="tag tag-good">recommended</span></p>
        <p class="d-note">
          Map each density to a distinct file — the 2× / 3× variants carry more pixels.
          <code style="color: #e3b341">VImage</code> accepts the map directly:
        </p>
        <div class="code-block">{{
`<VImage
  src="/avatar.png"
  :width="64" :height="64"
  :densities="{
    1: '/avatar.png',
    2: '/avatar@2x.png',
    3: '/avatar@3x.png',
  }"
/>`
        }}</div>
        <p class="d-note" style="margin-top: 12px">Resulting srcset:</p>
        <div class="code-block srcset-good">{{ mapSrcset || '— (no valid densities)' }}</div>

        <p class="panel-title" style="margin-top: 22px">
          List form <span class="tag tag-warn">same file ×N</span>
        </p>
        <p class="d-note">
          <code style="color: #e3b341">:densities="[1, 2, 3]"</code> reuses the single
          <code style="color: #e3b341">src</code> for every density — only useful when the URL is
          resolution-aware (a CDN endpoint).
        </p>
        <div class="code-block srcset-warn">{{ singleSrcset || '—' }}</div>
      </div>

      <div class="panel">
        <p class="panel-title">What your screen fetches</p>
        <p class="d-note">
          devicePixelRatio = <code style="color: #79c0ff">{{ dpr }}</code> → the browser picks the
          <code style="color: #79c0ff">{{ Math.min(Math.ceil(dpr), 3) }}×</code> candidate.
        </p>

        <div class="avatar-stage">
          <VImage
            :key="`${selectedIdx}-${reloadKey}`"
            class="avatar"
            :src="img.src400"
            :densities="fileMap"
            :width="64"
            :height="64"
            fit="cover"
            :lazy="false"
            @load="onLoad"
          />
          <div class="avatar-meta">
            <div class="d-row"><span>rendered</span><code>64 × 64 px</code></div>
            <div class="d-row"><span>DPR</span><code>{{ dpr }}</code></div>
            <div class="d-row">
              <span>currentSrc</span><code style="color: #3fb950">{{ liveSrc }}</code>
            </div>
          </div>
        </div>

        <p class="d-note" style="margin-top: 16px">
          A real <code style="color: #e3b341">&lt;VImage&gt;</code> with the density map above. On a
          1× screen the 1× file is fetched; a Retina (2×) visitor automatically gets the 2× file —
          same CSS size, sharper pixels.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.srcset-good {
  color: #3fb950;
}
.srcset-warn {
  color: #e3b341;
}
.d-note {
  color: #8b949e;
  font-size: 0.78rem;
  line-height: 1.6;
  margin-bottom: 10px;
}
.tag {
  font-size: 0.64rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  vertical-align: middle;
}
.tag-good {
  background: #1a2d1a;
  color: #3fb950;
}
.tag-warn {
  background: #2d2a1a;
  color: #e3b341;
}
.avatar-stage {
  display: flex;
  align-items: center;
  gap: 18px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #0d1117;
}
.avatar-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.78rem;
}
.d-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}
.d-row span {
  color: #8b949e;
}
.d-row code {
  color: #e6edf3;
}
</style>
