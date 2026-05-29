<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'
import BackgroundBox from './BackgroundBox.vue'

const selectedIdx = ref(0)
const usePlaceholder = ref(true)
const densitiesInput = ref('1,2')
const lazy = ref(true)
const reloadKey = ref(0)

const img = computed(() => images[selectedIdx.value])
const densities = computed(() =>
  densitiesInput.value
    .split(',')
    .map((d) => parseFloat(d.trim()))
    .filter((n) => !isNaN(n) && n > 0),
)

function reload() {
  reloadKey.value++
}
</script>

<template>
  <div>
    <p class="tab-title">useBackgroundImage — lazy + responsive backgrounds</p>
    <p class="tab-desc">
      CSS backgrounds support neither <code style="color: #e3b341">srcset</code> nor native lazy
      loading. This composable adds both: an <code style="color: #e3b341">image-set()</code> value
      for resolution switching plus IntersectionObserver gating with a blur-up placeholder. It
      returns a reactive <code style="color: #e3b341">:style</code> you bind yourself.
    </p>

    <div class="bg-layout">
      <div class="panel">
        <p class="panel-title">Controls</p>

        <div class="control-row">
          <span class="control-label">Photo</span>
          <select class="control-select" v-model="selectedIdx">
            <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">densities</span>
          <input class="control-input" style="flex: 1" v-model="densitiesInput" />
        </div>

        <div class="control-row">
          <span class="control-label">placeholder</span>
          <label class="toggle">
            <input type="checkbox" v-model="usePlaceholder" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">lazy</span>
          <label class="toggle">
            <input type="checkbox" v-model="lazy" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <button class="btn" style="margin-top: 12px; width: 100%" @click="reload">↺ Replay</button>

        <div class="code-block" style="margin-top: 16px">{{
`const { target, style } =
  useBackgroundImage('${img.src}', {
    densities: [${densities.join(', ')}],${usePlaceholder ? '\n    placeholder: lqip,' : ''}
    lazy: ${lazy},
  })

<div ref="target" :style="style" />`
        }}</div>
      </div>

      <div class="panel">
        <p class="panel-title">Preview</p>
        <BackgroundBox
          :key="`${selectedIdx}-${densitiesInput}-${usePlaceholder}-${lazy}-${reloadKey}`"
          :src="img.src"
          :densities="densities"
          :placeholder="usePlaceholder ? img.placeholder : undefined"
          :lazy="lazy"
        />
        <p style="color: #484f58; font-size: 0.72rem; margin-top: 12px; line-height: 1.6">
          The badge shows the load status. With a placeholder, the background starts blurred and
          sharpens on load.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
}
@media (max-width: 860px) {
  .bg-layout {
    grid-template-columns: 1fr;
  }
}
</style>
