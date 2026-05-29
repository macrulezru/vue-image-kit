<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const x = ref(0.5)
const y = ref(0.3)
const reloadKey = ref(0)

const img = computed(() => images[selectedIdx.value])
const objectPosition = computed(() => `${Math.round(x.value * 100)}% ${Math.round(y.value * 100)}%`)

function reload() {
  reloadKey.value++
}
</script>

<template>
  <div>
    <p class="tab-title">Focal point — keep the subject in frame</p>
    <p class="tab-desc">
      With <code style="color: #e3b341">fit="cover"</code> the image is cropped to the box. The
      <code style="color: #e3b341">:focal="{ x, y }"</code> prop (fractions 0–1) maps to
      <code style="color: #e3b341">object-position</code> so the point you care about survives the
      crop. Drag the sliders and watch the crop follow the marker.
    </p>

    <div class="focal-layout">
      <!-- Controls -->
      <div class="panel">
        <p class="panel-title">Controls</p>

        <div class="control-row">
          <span class="control-label">Photo</span>
          <select class="control-select" v-model="selectedIdx">
            <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">focal.x</span>
          <input type="range" min="0" max="1" step="0.01" v-model.number="x" style="flex: 1; accent-color: #1f6feb" />
          <code class="focal-val">{{ x.toFixed(2) }}</code>
        </div>

        <div class="control-row">
          <span class="control-label">focal.y</span>
          <input type="range" min="0" max="1" step="0.01" v-model.number="y" style="flex: 1; accent-color: #1f6feb" />
          <code class="focal-val">{{ y.toFixed(2) }}</code>
        </div>

        <div class="code-block" style="margin-top: 16px">{{
`<VImage
  src="${img.src}"
  alt="${img.name}"
  :width="${img.width}"
  :height="${img.height}"
  fit="cover"
  :focal="{ x: ${x.toFixed(2)}, y: ${y.toFixed(2)} }"
/>`
        }}</div>

        <p style="color: #8b949e; font-size: 0.78rem; margin-top: 14px; line-height: 1.6">
          object-position: <code style="color: #79c0ff">{{ objectPosition }}</code>
        </p>
        <button class="btn" style="margin-top: 8px; width: 100%" @click="reload">↺ Replay load</button>
      </div>

      <!-- Preview -->
      <div class="panel">
        <p class="panel-title">Preview (cropped to a square)</p>
        <div class="focal-frame">
          <VImage
            :key="`${selectedIdx}-${reloadKey}`"
            :src="img.src"
            :alt="img.name"
            :width="img.width"
            :height="img.height"
            fit="cover"
            :focal="{ x, y }"
            :thumbhash="img.thumbhash"
            style="width: 100%; height: 100%"
          />
          <!-- focal marker -->
          <span class="focal-dot" :style="{ left: `${x * 100}%`, top: `${y * 100}%` }" />
        </div>
        <p style="color: #484f58; font-size: 0.72rem; margin-top: 10px; text-align: center">
          The marker shows the focal point; the crop keeps it visible.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.focal-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
}
@media (max-width: 860px) {
  .focal-layout {
    grid-template-columns: 1fr;
  }
}
.focal-frame {
  position: relative;
  aspect-ratio: 1/1;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: #0d1117;
}
.focal-dot {
  position: absolute;
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: rgba(31, 111, 235, 0.6);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.focal-val {
  font-size: 0.8rem;
  color: #e6edf3;
  min-width: 34px;
  text-align: right;
}
</style>
