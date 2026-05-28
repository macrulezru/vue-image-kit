<script setup lang="ts">
import { ref, computed } from 'vue'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const img = computed(() => images[selectedIdx.value])
const reloadKey = ref(0)

interface FormatInfo {
  label: string
  ext: string
  type: string
  size: string
  currentSrc: string
  status: string
}

const formats = ref<FormatInfo[]>([])

function initFormats() {
  formats.value = [
    { label: 'JPEG', ext: 'jpg', type: 'image/jpeg', size: '—', currentSrc: '—', status: 'idle' },
    { label: 'WebP', ext: 'webp', type: 'image/webp', size: '—', currentSrc: '—', status: 'idle' },
    { label: 'AVIF', ext: 'avif', type: 'image/avif', size: '—', currentSrc: '—', status: 'idle' },
  ]
}
initFormats()

function reload() {
  initFormats()
  reloadKey.value++
}

// Fetch file sizes
async function fetchSize(url: string): Promise<string> {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    const len = r.headers.get('content-length')
    if (!len) return '—'
    const kb = Math.round(Number(len) / 1024)
    return `${kb} KB`
  } catch {
    return '—'
  }
}

async function onFormatLoad(idx: number, e: Event) {
  const imgEl = e.target as HTMLImageElement
  formats.value[idx].status = 'loaded'
  formats.value[idx].currentSrc = imgEl.currentSrc
  formats.value[idx].size = await fetchSize(imgEl.currentSrc)
}

function onFormatError(idx: number) {
  formats.value[idx].status = 'error'
}

const srcObject = computed(() => ({
  avif: img.value.avif,
  webp: img.value.webp,
  fallback: img.value.src,
}))

// Detect what the browser actually picks for the <picture>
const pictureSrc = ref('—')
function onPictureLoad(e: Event) {
  pictureSrc.value = (e.target as HTMLImageElement).currentSrc
}
</script>

<template>
  <div>
    <p class="tab-title">AVIF / WebP — format switching</p>
    <p class="tab-desc">
      When <code style="color:#e3b341">src</code> is an object, VImage renders a
      <code style="color:#e3b341">&lt;picture&gt;</code> with typed
      <code style="color:#e3b341">&lt;source&gt;</code> elements.
      The browser picks the best format it supports.
    </p>

    <div class="control-row" style="margin-bottom:24px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx" @change="reload">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <button class="btn" @click="reload">↺ Reload</button>
    </div>

    <!-- Picture with format switching -->
    <div class="panel" style="margin-bottom:24px">
      <p class="panel-title">VImage with SrcSet object</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <div>
          <div style="aspect-ratio:3/2;border-radius:8px;overflow:hidden;background:#0d1117">
            <VImage
              :key="reloadKey"
              :src="srcObject"
              :alt="img.name"
              :width="img.width"
              :height="img.height"
              :blurhash="img.blurhash"
              :lazy="false"
              style="width:100%;height:100%"
              @load="onPictureLoad"
            />
          </div>
          <div style="margin-top:10px;font-size:0.78rem;color:#8b949e">
            Browser selected:
            <span style="color:#3fb950">{{ pictureSrc.split('/').pop() || '—' }}</span>
          </div>
        </div>
        <div class="code-block">{{ `&lt;VImage
  :src="{
    avif: '${img.avif}',
    webp: '${img.webp}',
    fallback: '${img.src}',
  }"
  alt="${img.name}"
/&gt;

Renders:
&lt;picture&gt;
  &lt;source srcset="${img.avif}"
          type="image/avif" /&gt;
  &lt;source srcset="${img.webp}"
          type="image/webp" /&gt;
  &lt;img src="${img.src}" /&gt;
&lt;/picture&gt;` }}</div>
      </div>
    </div>

    <!-- Three formats side by side -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div
        v-for="(fmt, idx) in formats"
        :key="fmt.ext"
        class="panel"
      >
        <p class="panel-title">{{ fmt.label }}</p>
        <div style="aspect-ratio:3/2;border-radius:6px;overflow:hidden;background:#0d1117;margin-bottom:12px">
          <img
            :key="reloadKey"
            :src="`/images/${img.name}.${fmt.ext}`"
            :alt="fmt.label"
            style="width:100%;height:100%;object-fit:cover"
            @load="onFormatLoad(idx, $event)"
            @error="onFormatError(idx)"
          />
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.78rem">
          <div style="display:flex;justify-content:space-between">
            <span style="color:#8b949e">Status</span>
            <span class="badge" :class="`badge-${fmt.status}`">{{ fmt.status }}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#8b949e">File size</span>
            <span style="color:#e6edf3">{{ fmt.size }}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#8b949e">MIME</span>
            <span style="color:#e6edf3">{{ fmt.type }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
