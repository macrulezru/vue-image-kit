<script setup lang="ts">
import { ref, computed } from 'vue'
import { generateSizes } from 'vue-image-kit'
import { images } from '../assets/images'

const selectedIdx = ref(0)
const img = computed(() => images[selectedIdx.value])

const sizesInput = ref('(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px')
const generatedSizes = computed(() => generateSizes(sizesInput.value || undefined))

const currentSrcs = ref<Record<string, string>>({})
const reloadKey = ref(0)

const previews = [
  { key: 'narrow', label: 'Narrow', sizes: '400px',  expected: '400w',  hint: 'sizes="400px"'  },
  { key: 'medium', label: 'Medium', sizes: '800px',  expected: '800w',  hint: 'sizes="800px"'  },
  { key: 'wide',   label: 'Wide',   sizes: '1200px', expected: '1200w', hint: 'sizes="1200px"' },
]

const candidates = computed(() => [
  { width: '400w',  src: img.value.src400,  size: '~28 KB'  },
  { width: '800w',  src: img.value.src800,  size: '~101 KB' },
  { width: '1200w', src: img.value.src1200, size: '~165 KB' },
])

function onLoad(key: string, e: Event) {
  const src = (e.target as HTMLImageElement).currentSrc
  currentSrcs.value[key] = src ? src.split('/').pop() ?? '—' : '—'
}

function reload() {
  currentSrcs.value = {}
  reloadKey.value++
}
</script>

<template>
  <div>
    <p class="tab-title">srcset + sizes — resolution switching</p>
    <p class="tab-desc">
      <strong style="color:#f0f6fc">Same photo, different file sizes.</strong>
      The browser picks the smallest file that still looks sharp on the current screen —
      saving bandwidth without changing the visual content.
      Each preview below forces a specific image display size via <code style="color:#e3b341">sizes</code>,
      so the browser picks a different candidate and <code style="color:#e3b341">currentSrc</code> differs.
    </p>

    <div class="control-row" style="margin-bottom:24px">
      <span class="control-label">Photo</span>
      <select class="control-select" v-model="selectedIdx" @change="reload">
        <option v-for="(im, i) in images" :key="im.name" :value="i">{{ im.name }}</option>
      </select>
      <button class="btn" @click="reload">↺ Reload</button>
    </div>

    <!-- Three previews — each with a different fixed sizes value -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
      <div v-for="p in previews" :key="p.key" class="panel" style="padding:14px">
        <p class="panel-title" style="margin-bottom:10px">{{ p.label }}</p>

        <div style="aspect-ratio:3/2;border-radius:6px;overflow:hidden;background:#0d1117;margin-bottom:10px">
          <img
            :key="`${reloadKey}-${p.key}`"
            :srcset="img.srcset"
            :sizes="p.sizes"
            :src="img.src1200"
            :alt="p.label"
            style="width:100%;height:100%;object-fit:cover;display:block"
            @load="onLoad(p.key, $event)"
          />
        </div>

        <div style="display:flex;flex-direction:column;gap:5px;font-size:0.75rem">
          <div style="color:#484f58">{{ p.hint }}</div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#8b949e">Expected</span>
            <code style="color:#79c0ff">{{ p.expected }}</code>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span style="color:#8b949e">currentSrc</span>
            <code
              style="max-width:130px;text-align:right;word-break:break-all"
              :style="{ color: currentSrcs[p.key] ? '#3fb950' : '#484f58' }"
            >{{ currentSrcs[p.key] ?? '…' }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Srcset candidates with file sizes -->
    <div class="panel" style="margin-bottom:20px">
      <p class="panel-title">Srcset for {{ img.name }} — three real files</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        <div
          v-for="c in candidates"
          :key="c.width"
          style="display:grid;grid-template-columns:55px 1fr auto;align-items:center;gap:12px;padding:8px 12px;border-radius:6px;background:#0d1117;font-size:0.8rem"
        >
          <code style="color:#e3b341">{{ c.width }}</code>
          <span style="color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.src }}</span>
          <span style="color:#484f58;white-space:nowrap">{{ c.size }}</span>
        </div>
      </div>
      <pre class="code-block" style="font-size:0.72rem">{{ img.srcset }}</pre>
    </div>

    <!-- Sizes playground -->
    <div class="panel">
      <p class="panel-title">sizes — tell the browser how wide the image will render</p>
      <div class="control-row" style="margin-bottom:12px">
        <span class="control-label">sizes</span>
        <input class="control-input" style="flex:1" v-model="sizesInput" />
      </div>
      <pre class="code-block" style="font-size:0.72rem">&lt;VImage
  src="{{ img.name }}.jpg"
  :widths="[400, 800, 1200]"
  sizes="{{ generatedSizes }}"
/&gt;</pre>
      <p style="font-size:0.75rem;color:#484f58;margin:10px 0 0;line-height:1.6">
        The browser evaluates <code style="color:#e3b341">sizes</code> at load time (before downloading)
        to decide which <code style="color:#e3b341">srcset</code> candidate to fetch.
        DPR is factored in automatically — a Retina screen (2×) picks a 2× larger candidate.
      </p>
    </div>
  </div>
</template>
