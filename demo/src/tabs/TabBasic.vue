<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'
import type { ObjectFit } from 'vue-image-kit'

const selectedIdx = ref(0)
const lazy = ref(true)
const showBlurhash = ref(true)
const showLqip = ref(false)
const fit = ref<ObjectFit>('cover')
const withWidths = ref(false)
const fetchpriority = ref<'auto' | 'high' | 'low'>('auto')
const decoding = ref<'async' | 'sync' | 'auto'>('async')

const img = computed(() => images[selectedIdx.value])
const statusMap = ref<Record<string, string>>({})
const reloadKey = ref(0)

function getStatus(name: string) {
  return statusMap.value[name] ?? 'idle'
}
function onLoad(name: string) {
  statusMap.value[name] = 'loaded'
}
function onError(name: string) {
  statusMap.value[name] = 'error'
}

function reload() {
  statusMap.value = {}
  reloadKey.value++
}
</script>

<template>
  <div>
    <p class="tab-title">Basic — VImage component</p>
    <p class="tab-desc">
      Configure props and observe the full loading cycle: idle → loading → loaded. Try toggling
      blurhash or LQIP to compare placeholder strategies.
    </p>

    <div class="tab-basic__main-block">
      <!-- Controls -->
      <div class="panel">
        <p class="panel-title">Controls</p>

        <div class="control-row">
          <span class="control-label">Photo</span>
          <select class="control-select" v-model="selectedIdx" @change="reload">
            <option v-for="(img, i) in images" :key="img.name" :value="i">
              {{ img.name }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">fit</span>
          <select class="control-select" v-model="fit">
            <option value="cover">cover</option>
            <option value="contain">contain</option>
            <option value="fill">fill</option>
            <option value="none">none</option>
            <option value="scale-down">scale-down</option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">lazy</span>
          <label class="toggle">
            <input type="checkbox" v-model="lazy" @change="reload" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">blurhash</span>
          <label class="toggle">
            <input type="checkbox" v-model="showBlurhash" @change="reload" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">LQIP</span>
          <label class="toggle">
            <input type="checkbox" v-model="showLqip" @change="reload" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">srcset</span>
          <label class="toggle">
            <input type="checkbox" v-model="withWidths" @change="reload" />
            <span class="toggle-track" />
            <span class="toggle-thumb" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">fetchpriority</span>
          <select class="control-select" v-model="fetchpriority">
            <option value="auto">auto</option>
            <option value="high">high</option>
            <option value="low">low</option>
          </select>
        </div>

        <div class="control-row">
          <span class="control-label">decoding</span>
          <select class="control-select" v-model="decoding">
            <option value="async">async</option>
            <option value="sync">sync</option>
            <option value="auto">auto</option>
          </select>
        </div>

        <div style="margin-top: 16px; display: flex; align-items: center; gap: 10px">
          <span class="control-label">Status</span>
          <span class="badge" :class="`badge-${getStatus(img.name)}`">
            {{ getStatus(img.name) }}
          </span>
        </div>

        <button class="btn" style="margin-top: 20px; width: 100%" @click="reload">↺ Reload</button>
      </div>

      <!-- Preview -->
      <div class="panel" style="display: flex; flex-direction: column; gap: 16px">
        <p class="panel-title">Preview</p>

        <div style="aspect-ratio: 3/2; border-radius: 8px; overflow: hidden; background: #0d1117">
          <VImage
            :key="reloadKey"
            :src="img.src"
            :alt="img.name"
            :width="img.width"
            :height="img.height"
            :blurhash="showBlurhash ? img.blurhash : undefined"
            :placeholder="showLqip ? img.placeholder : undefined"
            :widths="withWidths ? [400, 800, 1200] : undefined"
            :lazy="lazy"
            :fit="fit"
            :fetchpriority="fetchpriority !== 'auto' ? fetchpriority : undefined"
            :decoding="decoding"
            style="width: 100%; height: 100%"
            @load="onLoad(img.name)"
            @error="onError(img.name)"
          />
        </div>

        <div class="code-block">
          {{
            `&lt;VImage
  src="${img.src}"
  alt="${img.name}"
  :width="${img.width}"
  :height="${img.height}"${showBlurhash ? `\n  blurhash="${img.blurhash}"` : ''}${showLqip ? '\n  placeholder="data:image/jpeg;base64,..."' : ''}${withWidths ? '\n  :widths="[400, 800, 1200]"' : ''}
  :lazy="${lazy}"
  fit="${fit}"${fetchpriority !== 'auto' ? `\n  fetchpriority="${fetchpriority}"` : ''}
  decoding="${decoding}"
/&gt;`
          }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-basic__main-block {
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: 24px;
}
</style>
