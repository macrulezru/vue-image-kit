<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'
import HeadlessPreview from './HeadlessPreview.vue'

const selectedIdx = ref(0)
const img = computed(() => images[selectedIdx.value])
</script>

<template>
  <div>
    <p class="tab-title">Headless — useImage composable</p>
    <p class="tab-desc">
      <code style="color:#e3b341">useImage()</code> exposes the
      <code style="color:#e3b341">idle → loading → loaded | error</code> state machine
      and computed <code style="color:#e3b341">imgAttrs</code> without rendering anything.
      Build fully custom image components on top of it.
    </p>

    <div class="control-row" style="margin-bottom:24px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
    </div>

    <!-- key forces a full remount when photo changes → useImage re-runs with new src -->
    <HeadlessPreview :key="selectedIdx" :img="img" />
  </div>
</template>
